import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getToken } from 'next-auth/jwt';
import * as jose from 'jose';

/**
 * This API route acts as a proxy to the API Gateway service.
 * It retrieves a paginated list of interviews through the API Gateway, which
 * then handles the authenticated communication with the database service.
 * 
 * This endpoint accepts the following query parameters:
 * - limit: number of interviews to return (default: 10)
 * - offset: number of interviews to skip (default: 0)
 */

// Get the API Gateway URL from environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// Define logging helpers within this scope
const logPrefix = "[Frontend API /api/interviews]";
const log = (...args: any[]) => console.log(logPrefix, ...args);
const logError = (...args: any[]) => console.error(logPrefix, ...args);

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

export async function GET(request: NextRequest) {
  // log("GET request received"); // Can be removed unless debugging specific request issues
  try {
    // 1. Initial Session Check
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      logError("No valid NextAuth session found.");
      return NextResponse.json({ status: 'error', message: 'Authentication required' }, { status: 401 });
    }
    // log(`Session validated for user: ${session.user.id}`); // Can be removed

    // 2. Get DECODED Token Payload
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
    // log("Decoded token payload retrieved successfully:", decodedTokenPayload); // Keep this for debugging? Or remove.

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
        // log("Manually signed JWS token for API Gateway successfully."); // Can be removed
    } catch (signingError) {
        logError("Failed to manually sign JWS token:", signingError);
         return NextResponse.json({ status: 'error', message: 'Failed to prepare authentication token' }, { status: 500 });
    }

    // 4. Prepare Request to API Gateway using the NEW JWS token
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') || '10';
    const offset = url.searchParams.get('offset') || '0';
    // log(`Fetching interviews with limit ${limit} and offset ${offset}`); // Can be removed
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${signedApiToken}` 
    };
    // log("Headers prepared for API Gateway:", { Authorization: `Bearer ${signedApiToken.substring(0, 15)}...` }); // Can be removed

    const apiUrl = `${gatewayUrl}/api/interviews?limit=${limit}&offset=${offset}`;
    log(`Forwarding request to API Gateway: ${apiUrl}`); // Keep this one

    // 5. Make the fetch call (with retry logic)
    const MAX_RETRIES = 1; // Reduce retries for internal calls unless needed
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < MAX_RETRIES) {
      try {
        // log(`Attempt ${retryCount + 1} to fetch from API Gateway...`); // Can be removed
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // Increased timeout to 30 seconds

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers,
          signal: controller.signal,
          credentials: 'include',
          cache: 'no-store',
          next: { revalidate: 0 }
        });

        clearTimeout(timeoutId);
        const responseStatus = response.status; // Store status before reading text
        const responseText = await response.text();
        // log(`Received response status from API Gateway: ${responseStatus}`); // Redundant if logging text
        // log(`Received response text (truncated): ${responseText.substring(0, 500)}...`); // Redundant if parsing

        if (!response.ok) {
          logError(`API Gateway error (${responseStatus}):`, responseText);
          throw new Error(`API Gateway returned ${responseStatus}: ${responseText}`);
        }

        try {
            const data = JSON.parse(responseText);
            // log("Successfully parsed JSON response from API Gateway."); // Can be removed
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
          const delay = Math.pow(2, retryCount) * 100;
          // log(`Waiting ${delay}ms before retry...`); // Can be removed
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    const finalErrorMessage = `Failed to fetch interviews after ${MAX_RETRIES} attempts. Last error: ${lastError?.message || 'Unknown error'}`;
    logError(finalErrorMessage);
    return NextResponse.json({ status: 'error', message: finalErrorMessage }, { status: 500 });

  } catch (error: any) {
    logError('Unexpected error in GET handler:', error);
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error fetching interviews' }, { status: 500 });
  }
} 