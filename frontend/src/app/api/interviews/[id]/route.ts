import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getToken } from 'next-auth/jwt';
import * as jose from 'jose';

// Get the API Gateway URL from environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// Define logging helpers within this scope
const logPrefix = "[Frontend API /api/interviews/[id]]";
const log = (...args: any[]) => console.log(logPrefix, ...args);
const logError = (...args: any[]) => console.error(logPrefix, ...args);
const logWarn = (...args: any[]) => console.warn(logPrefix, ...args);

// Determine the correct Gateway URL based on environment
const gatewayUrl = IS_DEVELOPMENT ? "http://api_gateway:8000" : API_URL;

// Prepare the signing key 
const jwtSecret = process.env.NEXTAUTH_SECRET;
let signingKey: Uint8Array | null = null;
if (jwtSecret) {
  signingKey = new TextEncoder().encode(jwtSecret);
} else {
  logError("CRITICAL: NEXTAUTH_SECRET is not set! Cannot sign token.");
}

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  // log("GET request received"); // Can remove
  try {
    // 1. Initial Session Check
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      logError("No valid NextAuth session found.");
      return NextResponse.json({ status: 'error', message: 'Authentication required' }, { status: 401 });
    }
    // log(`Session validated for user: ${session.user.id}`); // Can remove

    // 2. Get Interview ID from Path
    const params = await context.params;
    const { id } = params;
    if (!id) {
       logError("Interview ID is required but missing from context");
      return NextResponse.json({ status: 'error', message: 'Interview ID is required' }, { status: 400 });
    }
    // log(`Target Interview ID: ${id}`); // Can remove

    // 3. Get DECODED Token Payload
    let decodedTokenPayload: any = null;
    try {
        decodedTokenPayload = await getToken({
            req: request as any,
            secret: process.env.NEXTAUTH_SECRET,
            secureCookie: process.env.NODE_ENV === "production"
        });
    } catch (tokenError) {
        logError("Error calling getToken:", tokenError);
    }
    if (!decodedTokenPayload || !decodedTokenPayload.sub) {
        logError("Failed to retrieve valid decoded token payload or missing 'sub' claim.", decodedTokenPayload);
        return NextResponse.json({ status: 'error', message: 'Failed to retrieve valid authentication payload' }, { status: 500 });
    }
    // log("Decoded token payload retrieved successfully:", decodedTokenPayload); // Can remove

    // 4. Manually Sign a *NEW* JWS Token for API Gateway
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
         return NextResponse.json({ status: 'error', message: 'Failed to prepare authentication token' }, { status: 500 });
    }
    
    // 5. Prepare Request to API Gateway using the NEW JWS token
    // log(`Target API URL: ${API_URL}`); // Can remove
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${signedApiToken}`
    };
    // log("Headers prepared for API Gateway:", { Authorization: `Bearer ${signedApiToken.substring(0, 15)}...` }); // Can remove

    const apiUrl = `${gatewayUrl}/api/interviews/${id}`;
    log(`Forwarding request to API Gateway: ${apiUrl}`); // Keep this one

    // 6. Make the fetch call (with retry logic)
    const MAX_RETRIES = 1; // Reduce retries
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < MAX_RETRIES) {
      try {
        // log(`Attempt ${retryCount + 1} to fetch details from API Gateway...`); // Can remove
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); 

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers,
          signal: controller.signal,
          credentials: 'include',
          cache: 'no-store',
          next: { revalidate: 0 }
        });

        clearTimeout(timeoutId);
        const responseStatus = response.status;
        const responseText = await response.text(); 
        // log(`Received response status from API Gateway: ${responseStatus}`); // Redundant
        // log(`Received response text (truncated): ${responseText.substring(0, 500)}...`); // Redundant

        if (responseStatus === 404) {
            logError("API Gateway returned 404 - Interview not found");
          return NextResponse.json({ status: 'error', message: 'Interview not found' }, { status: 404 });
        }
        if (responseStatus === 403) {
            logError("API Gateway returned 403 - Not authorized");
          return NextResponse.json({ status: 'error', message: 'Not authorized to access this interview' }, { status: 403 });
        }
        if (!response.ok) {
          logError(`API Gateway error (${responseStatus}):`, responseText);
          throw new Error(`API Gateway call failed with status ${responseStatus}. Response: ${responseText}`);
        }

        try {
            const data = JSON.parse(responseText);
            // log("Successfully parsed JSON response from API Gateway."); // Can remove
            return NextResponse.json(data); // Success!
        } catch(parseError) {
            logError("Failed to parse JSON response from API Gateway", parseError, "Response Text:", responseText);
            throw new Error(`Failed to parse API Gateway response as JSON.`);
        }

      } catch (error: any) {
        lastError = error;
        retryCount++;
        logError(`Attempt ${retryCount} failed: ${error.message}`);
        if (retryCount < MAX_RETRIES) {
          const delay = Math.pow(2, retryCount) * 200;
          // log(`Waiting ${delay}ms before retry...`); // Can remove
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    const finalErrorMessage = `Failed to fetch interview details for ${id} after ${MAX_RETRIES} attempts. Last error: ${lastError?.message || 'Unknown error'}`;
    logError(finalErrorMessage);
    return NextResponse.json({ status: 'error', message: finalErrorMessage }, { status: 500 });

  } catch (error: any) {
    logError('Unexpected error in GET handler:', error);
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error fetching interview details' }, { status: 500 });
  }
} 