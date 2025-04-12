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
  { params }: { params: { id: string } }
) {
  const interviewId = params.id;
  log(`GET request received for ID: ${interviewId}`);
  try {
    // 1. Initial Session Check
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      logError("No valid NextAuth session found.");
      return NextResponse.json({ status: 'error', message: 'Authentication required' }, { status: 401 });
    }
    // log(`Session validated for user: ${session.user.id}`); // Can remove

    // 2. Get Interview ID from Path
    if (!interviewId) {
       logError("Interview ID is required but missing from context");
      return NextResponse.json({ status: 'error', message: 'Interview ID is required' }, { status: 400 });
    }
    // log(`Target Interview ID: ${interviewId}`); // Can remove

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

    const apiUrl = `${gatewayUrl}/api/interviews/${interviewId}`;
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
    
    const finalErrorMessage = `Failed to fetch interview details for ${interviewId} after ${MAX_RETRIES} attempts. Last error: ${lastError?.message || 'Unknown error'}`;
    logError(finalErrorMessage);
    return NextResponse.json({ status: 'error', message: finalErrorMessage }, { status: 500 });

  } catch (error: any) {
    logError('Unexpected error in GET handler:', error);
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error fetching interview details' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  const interviewId = params.id;
  log(`PUT request received for ID: ${interviewId}`);
  try {
    // 1. Initial Session Check (Same as GET)
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      logError("No valid NextAuth session found.");
      return NextResponse.json({ status: 'error', message: 'Authentication required' }, { status: 401 });
    }
    const currentUserId = session.user.id;

    // 2. Get Decoded Token Payload (Same as GET)
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
    if (!decodedTokenPayload || !decodedTokenPayload.sub || decodedTokenPayload.sub !== currentUserId) {
      logError("Failed to retrieve valid token payload or mismatch with session.", decodedTokenPayload);
      return NextResponse.json({ status: 'error', message: 'Invalid authentication payload' }, { status: 500 });
    }

    // 3. Manually Sign a NEW JWS Token for API Gateway (Same as GET)
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
    } catch (signingError) {
      logError("Failed to manually sign JWS token:", signingError);
      return NextResponse.json({ status: 'error', message: 'Failed to prepare authentication token' }, { status: 500 });
    }

    // 4. Get Update Data from Request Body
    let updateData: any;
    try {
      updateData = await request.json();
      // Basic validation: ensure it's an object. Specific field validation
      // will be handled by the API Gateway and Database Service.
      if (!updateData || typeof updateData !== 'object') {
        logError("Invalid update data received. Expected JSON object.", updateData);
        return NextResponse.json({ status: 'error', message: 'Invalid request body' }, { status: 400 });
      }
    } catch (parseError) {
        logError("Failed to parse request body as JSON.", parseError);
        return NextResponse.json({ status: 'error', message: 'Invalid JSON body' }, { status: 400 });
    }

    // 5. Prepare Request to API Gateway
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${signedApiToken}`
    };
    const apiUrl = `${gatewayUrl}/api/interviews/${interviewId}`;
    log(`Forwarding PUT request to API Gateway: ${apiUrl}`);

    // 6. Make the fetch call
    try {
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData), // Forward the entire updateData object
        credentials: 'include',
        cache: 'no-store'
      });

      const responseStatus = response.status;
      const responseData = await response.json();
      log(`Received response status from API Gateway: ${responseStatus}`);

      if (!response.ok) {
        logError(`API Gateway error (${responseStatus}):`, responseData);
        // Forward the status code and error message from the gateway
        return NextResponse.json(responseData, { status: responseStatus });
      }

      log("Successfully received PUT response from API Gateway.");
      return NextResponse.json(responseData);

    } catch (fetchError: any) {
      logError(`Error fetching from API Gateway during PUT: ${fetchError.message}`);
      return NextResponse.json({ status: 'error', message: 'Failed to connect to update service' }, { status: 502 }); // Bad Gateway
    }

  } catch (error: any) {
    logError('Unexpected error in PUT handler:', error);
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error updating interview' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  const interviewId = params.id;
  log(`DELETE request received for ID: ${interviewId}`);

  // 1. Verify session first 
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id) {
    logError("No valid NextAuth session found.");
    return NextResponse.json({ status: 'error', message: 'Authentication required' }, { status: 401 });
  }
  const currentUserId = session.user.id;

  // 2. Get DECODED Token Payload (For signing API token)
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
  if (!decodedTokenPayload || !decodedTokenPayload.sub || decodedTokenPayload.sub !== currentUserId) {
    logError("Failed to retrieve valid token payload or mismatch with session.", decodedTokenPayload);
    return NextResponse.json({ status: 'error', message: 'Invalid authentication payload' }, { status: 500 });
  }

  // 3. Manually Sign a *NEW* JWS Token for API Gateway
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
  } catch (signingError) {
      logError("Failed to manually sign JWS token:", signingError);
      return NextResponse.json({ status: 'error', message: 'Failed to prepare authentication token' }, { status: 500 });
  }

  // 4. Prepare Request to API Gateway
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${signedApiToken}`
  };
  // Add userId as query param for authorization check in the backend service
  const apiUrl = `${gatewayUrl}/api/interviews/${interviewId}?userId=${currentUserId}`;
  log(`Forwarding DELETE request to API Gateway: ${apiUrl}`);

  // 5. Make the fetch call
  try {
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers,
      credentials: 'include',
      cache: 'no-store'
    });

    const responseStatus = response.status;
    
    // For DELETE, 200 OK or 204 No Content are typical success responses
    if (response.ok) { 
      log("Successfully received DELETE success response from API Gateway.");
      // Try to parse JSON in case the backend sends back the deleted object
      try {
        const data = await response.json();
        return NextResponse.json(data, { status: responseStatus });
      } catch {
        // If no body or non-JSON body, just return status
        return new NextResponse(null, { status: responseStatus });
      }
    } else {
      // Handle specific errors like 404 Not Found or 403 Forbidden
      let errorDetail = 'Failed to delete interview';
      try {
          const errorJson = await response.json();
          errorDetail = errorJson.message || errorJson.detail || JSON.stringify(errorJson);
      } catch {
          errorDetail = response.statusText;
      }
      logError(`API Gateway error (${responseStatus}) during DELETE: ${errorDetail}`);
      return NextResponse.json({ status: 'error', message: errorDetail }, { status: responseStatus });
    }

  } catch (fetchError: any) {
    logError(`Error fetching from API Gateway during DELETE: ${fetchError.message}`);
    return NextResponse.json({ status: 'error', message: 'Failed to connect to delete service' }, { status: 502 }); // Bad Gateway
  }
} 