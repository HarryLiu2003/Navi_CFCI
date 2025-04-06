import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import * as jose from 'jose';
import { authOptions } from '../auth/[...nextauth]/route';

// Get the API Gateway URL from environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// Define logging helpers within this scope
const logPrefix = "[Frontend API /api/analyze-transcript]";
const log = (...args: any[]) => console.log(logPrefix, ...args);
const logError = (...args: any[]) => console.error(logPrefix, ...args);

// Determine the correct Gateway URL based on environment
const gatewayUrl = IS_DEVELOPMENT ? "http://api_gateway:8000" : API_URL;

// Prepare the signing key (must match API Gateway JWT_SECRET)
const jwtSecret = process.env.NEXTAUTH_SECRET;
let signingKey: Uint8Array | null = null;
if (jwtSecret) {
  signingKey = new TextEncoder().encode(jwtSecret);
} else {
  logError("CRITICAL: NEXTAUTH_SECRET is not set! Cannot sign token.");
}

export async function POST(request: NextRequest) {
  // log("POST request received"); // Can remove
  try {
    // 1. Initial Session Check
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      logError("No valid NextAuth session found.");
      return NextResponse.json({ status: 'error', message: 'Authentication required' }, { status: 401 });
    }
    const currentUserId = session.user.id;
    // log(`Session validated for user: ${currentUserId}`); // Can remove

    // 2. Get Decoded Token Payload (to get claims for signing)
    let decodedTokenPayload: any = null;
    try {
      decodedTokenPayload = await getToken({
        req: request as any, // Pass the original request
        secret: process.env.NEXTAUTH_SECRET,
        secureCookie: process.env.NODE_ENV === "production"
      });
    } catch (tokenError) {
      logError("Error calling getToken:", tokenError);
    }
    if (!decodedTokenPayload || !decodedTokenPayload.sub) {
        logError("Failed to retrieve valid decoded token payload or missing 'sub' claim.", decodedTokenPayload);
        return NextResponse.json({ status: 'error', message: 'Failed to retrieve auth payload' }, { status: 500 });
    }
     // Ensure extracted ID matches session ID for consistency check
    if (decodedTokenPayload.sub !== currentUserId) {
        logError(`Mismatch between session user ID (${currentUserId}) and token sub (${decodedTokenPayload.sub})`);
        // Handle this potential inconsistency, maybe return an error
        return NextResponse.json({ status: 'error', message: 'Authentication context mismatch' }, { status: 400 });
    }
    // log("Decoded token payload retrieved successfully."); // Can remove

    // 3. Manually Sign a NEW JWS Token for API Gateway
    if (!signingKey) {
      logError("Cannot proceed: Signing key not available.");
      return NextResponse.json({ status: 'error', message: 'Internal server configuration error' }, { status: 500 });
    }
    let signedApiToken: string;
    try {
      const claimsToSign = { 
          sub: decodedTokenPayload.sub,
          name: decodedTokenPayload.name,
          email: decodedTokenPayload.email,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (5 * 60), // 5 min expiry
      };
      signedApiToken = await new jose.SignJWT(claimsToSign)
        .setProtectedHeader({ alg: 'HS256' })
        .sign(signingKey);
      // log("Manually signed JWS token for API Gateway successfully."); // Can remove
    } catch (signingError) {
      logError("Failed to manually sign JWS token:", signingError);
      return NextResponse.json({ status: 'error', message: 'Failed to prepare auth token' }, { status: 500 });
    }

    // 4. Prepare FormData and Headers for API Gateway
    const originalFormData = await request.formData();
    const forwardedFormData = new FormData();
    
    // Append file if it exists
    const file = originalFormData.get('file');
    
    // More robust check for File object from FormData in Node.js environment
    if (file && typeof file === 'object' && typeof file.name === 'string' && typeof file.size === 'number' && typeof file.arrayBuffer === 'function') {
        // It looks like a File object, append it
        // Note: Need to explicitly cast to File or Blob for append
        forwardedFormData.append('file', file as Blob, file.name);
        // log(`Forwarding file: ${file.name}, size: ${file.size}, type: ${file.type}`); // Can remove
    } else {
        logError("File object not found or invalid in original form data.", file);
        return NextResponse.json({ status: 'error', message: 'Valid file missing in request' }, { status: 400 });
    }

    // Append other form fields, ensuring userId uses the validated one
    let userIdFormField: string | null = null;
    originalFormData.forEach((value, key) => {
        if (key !== 'file') {
             // Crucially, use the validated user ID from the token/session
             const finalValue = (key.toLowerCase() === 'userid') ? currentUserId : value;
             forwardedFormData.append(key, finalValue);
             if (key.toLowerCase() === 'userid') userIdFormField = currentUserId;
             // log(`Forwarding form field: ${key} = ${finalValue}`); // Can remove
        }
    });
     // Ensure userId is present if not sent initially (should be from session now)
    if (!userIdFormField) {
         forwardedFormData.append('userId', currentUserId);
         // log(`Added missing userId field: ${currentUserId}`); // Can remove
    }

    const headers = {
      // Content-Type is set automatically by fetch for FormData
      'Authorization': `Bearer ${signedApiToken}`,
    };
    // log("Headers prepared for API Gateway:", { Authorization: `Bearer ${signedApiToken.substring(0, 15)}...` }); // Can remove

    // 5. Forward request to API Gateway
    const apiUrl = `${gatewayUrl}/api/interview_analysis/analyze`;
    log(`Forwarding POST request to API Gateway: ${apiUrl}`);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: forwardedFormData,
        // Do NOT include credentials: 'include' when sending FormData + Auth header
      });

      const responseStatus = response.status; // Store status
      const responseData = await response.json(); // Assume gateway returns JSON

      if (!response.ok) {
          logError(`API Gateway returned error ${responseStatus}:`, responseData);
           // Forward the status code and error message from the gateway
          return NextResponse.json(responseData, { status: responseStatus });
      }
      
      // log("Successfully received response from API Gateway."); // Can remove
      // Forward the successful response from the gateway
      return NextResponse.json(responseData);

    } catch (fetchError) {
      logError("Error fetching from API Gateway:", fetchError);
      return NextResponse.json({ status: 'error', message: 'Failed to connect to analysis service' }, { status: 502 }); // Bad Gateway
    }

  } catch (error: any) {
    logError('Unexpected error in POST handler:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Internal server error processing analysis request' },
      { status: 500 }
    );
  }
} 