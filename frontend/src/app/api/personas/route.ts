import { NextResponse, NextRequest } from 'next/server' 
import { getToken } from "next-auth/jwt"
import * as jose from 'jose'; // Import jose
// import { logger } from '@/lib/logger'; // Removed logger import

// Ensure API_URL is read correctly, provide a default if necessary
const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// Determine the correct Gateway URL based on environment
const gatewayUrl = IS_DEVELOPMENT ? "http://api_gateway:8000" : API_GATEWAY_URL;

export async function GET(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[/api/personas] NEXTAUTH_SECRET is not set."); // Use console.error
    return NextResponse.json({ message: 'Server configuration error' }, { status: 500 });
  }
  // Prepare the signing key (moved inside try block for better scope)
  let signingKey: Uint8Array | null = new TextEncoder().encode(secret);

  try {
    // Get the DECODED token payload from the request using next-auth
    const decodedTokenPayload = await getToken({ req: request, secret: secret });

    // Check if payload exists and contains the subject (user ID)
    if (!decodedTokenPayload || !decodedTokenPayload.sub) {
      console.warn("[/api/personas] No valid decoded token payload found for request."); // Use console.warn
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Manually sign a NEW JWS Token for API Gateway (like in the PUT route)
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
        console.error("[/api/personas] Failed to manually sign JWS token:", signingError);
         return NextResponse.json({ status: 'error', message: 'Failed to prepare authentication token' }, { status: 500 });
    }

    // Construct the target URL for the API Gateway
    const targetUrl = `${gatewayUrl}/api/personas`; // Use gatewayUrl
    console.info(`[/api/personas] Forwarding request for user ${decodedTokenPayload.sub} to ${targetUrl}`); // Use console.info

    // Make the authenticated request to the API Gateway using the NEWLY SIGNED token
    const apiResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${signedApiToken}`,
        'Content-Type': 'application/json',
      },
      // No credentials needed for server-to-server
      cache: 'no-store' // Ensure fresh data for personas list
    });

    // Parse the response from the API Gateway
    const data = await apiResponse.json();

    // Check if the gateway request was successful
    if (!apiResponse.ok) {
      console.error(
        `[/api/personas] API Gateway returned error ${apiResponse.status}: ${JSON.stringify(data)}`
      );
      return NextResponse.json(
        { message: data.detail || data.message || 'Error fetching personas from gateway' }, 
        { status: apiResponse.status }
      );
    }

    console.info(`[/api/personas] Successfully fetched personas from gateway.`);
    return NextResponse.json(data, { status: 200 });

  } catch (error: any) {
    console.error(`[/api/personas] Internal error: ${error.message}`, { error });
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
