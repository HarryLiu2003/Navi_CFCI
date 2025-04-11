import { NextResponse, NextRequest } from 'next/server'
// import { getServerSession } from "next-auth/next" // No longer needed if using getToken
import { getToken } from "next-auth/jwt";
import { authOptions } from "../auth/[...nextauth]/route"
import * as jose from 'jose'; // Import jose

// Determine Gateway URL based on environment (Standard Practice)
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'; // Public URL for production/external
const GATEWAY_URL = IS_DEVELOPMENT ? "http://api_gateway:8000" : API_URL; // Use service name in dev

// Logging helpers (Standard Practice)
const logPrefix = "[Frontend API /api/projects]";
const log = (...args: any[]) => console.log(logPrefix, ...args);
const logError = (...args: any[]) => console.error(logPrefix, ...args);

// Prepare the signing key (Standard Practice)
const jwtSecret = process.env.NEXTAUTH_SECRET;
let signingKey: Uint8Array | null = null;
if (jwtSecret) {
  try {
    signingKey = new TextEncoder().encode(jwtSecret);
    log("JWT Signing key prepared.");
  } catch (err) {
    logError("Failed to encode NEXTAUTH_SECRET:", err);
  }
} else {
  logError("CRITICAL: NEXTAUTH_SECRET is not set! Cannot sign token for gateway calls.");
}

// GET Handler to fetch projects
export async function GET(request: NextRequest) {
  // 1. Get user token payload
  const decodedTokenPayload = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!decodedTokenPayload || !decodedTokenPayload.sub) {
    logError("GET Unauthorized: No valid token payload or sub claim found.");
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }
  const userId = decodedTokenPayload.sub;
  log(`GET Request received for user: ${userId}`);

  // 2. Check if signing key is available
  if (!signingKey) {
    logError("GET Internal Server Error: Signing key not available due to missing NEXTAUTH_SECRET.");
    return NextResponse.json({ status: 'error', message: 'Internal server configuration error' }, { status: 500 });
  }

  // 3. Manually Sign a *NEW* JWS Token for API Gateway
  let signedApiToken: string;
  try {
    const claimsToSign = {
      sub: userId,
      name: decodedTokenPayload.name,
      email: decodedTokenPayload.email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (5 * 60), // 5 min expiry
    };
    signedApiToken = await new jose.SignJWT(claimsToSign)
      .setProtectedHeader({ alg: 'HS256' })
      .sign(signingKey);
  } catch (signingError) {
    logError("GET Failed to manually sign JWS token:", signingError);
    return NextResponse.json({ status: 'error', message: 'Failed to prepare authentication token' }, { status: 500 });
  }

  try {
    // 4. Extract query parameters (limit, offset) if needed
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50'; // Default limit
    const offset = searchParams.get('offset') || '0'; // Default offset

    // 5. Prepare request to the API Gateway
    const gatewayEndpoint = `${GATEWAY_URL}/api/projects?limit=${limit}&offset=${offset}`; // Pass params

    log(`Calling Gateway (GET): ${gatewayEndpoint}`);

    // 6. Call the API Gateway endpoint with the signed token
    const response = await fetch(gatewayEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${signedApiToken}`, // Add the signed token
        'Accept': 'application/json'
      },
      // Add cache control if needed, e.g., cache: 'no-store' for fresh data
      cache: 'no-store' 
    });

    log(`Gateway GET response status: ${response.status}`);

    // 7. Process the response from the API Gateway
    const responseData = await response.json();

    if (!response.ok) {
      logError(`Error from Gateway (GET ${response.status}):`, responseData);
      const status = response.status || 500;
      return NextResponse.json(
        { status: 'error', message: responseData.detail || responseData.message || 'Failed to fetch projects via gateway' },
        { status: status }
      );
    }

    log(`Successfully fetched projects via Gateway.`);
    return NextResponse.json(responseData, { status: response.status });

  } catch (error: any) {
    // Catch fetch errors or other unexpected errors
    logError('Unexpected error in GET handler:', error);
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error' }, { status: 500 });
  }
}

// POST Handler (existing code)
export async function POST(request: NextRequest) {
  // 1. Get user token payload
  const decodedTokenPayload = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!decodedTokenPayload || !decodedTokenPayload.sub) {
    logError("Unauthorized: No valid token payload or sub claim found.");
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }
  const userId = decodedTokenPayload.sub;
  log(`Request received for user: ${userId}`);

  // 2. Check if signing key is available
  if (!signingKey) {
    logError("Internal Server Error: Signing key not available due to missing NEXTAUTH_SECRET.");
    return NextResponse.json({ status: 'error', message: 'Internal server configuration error' }, { status: 500 });
  }

  // 3. Manually Sign a *NEW* JWS Token for API Gateway (Standard Practice)
  let signedApiToken: string;
  try {
      const claimsToSign = { 
          sub: userId, 
          name: decodedTokenPayload.name,
          email: decodedTokenPayload.email,
          // Add other relevant claims if needed by the gateway's verify_token
          iat: Math.floor(Date.now() / 1000), // Issued at time
          exp: Math.floor(Date.now() / 1000) + (5 * 60), // Expires in 5 minutes
      };
      signedApiToken = await new jose.SignJWT(claimsToSign)
        .setProtectedHeader({ alg: 'HS256' }) // Use the same algorithm expected by the gateway
        .sign(signingKey);
      // log("Manually signed JWS token for API Gateway successfully."); // Optional debug log
  } catch (signingError) {
      logError("Failed to manually sign JWS token:", signingError);
       return NextResponse.json({ status: 'error', message: 'Failed to prepare authentication token' }, { status: 500 });
  }

  try {
    // 4. Parse request body
    let body;
    try {
        body = await request.json();
    } catch (parseError) {
        logError("Failed to parse request body:", parseError);
        return NextResponse.json({ status: 'error', message: 'Invalid request body' }, { status: 400 });
    }
    const { name, description } = body;

    if (!name) {
      logError("Bad Request: Project name is missing.");
      return NextResponse.json({ status: 'error', message: 'Project name is required' }, { status: 400 });
    }

    // 5. Prepare request to the API Gateway
    const gatewayEndpoint = `${GATEWAY_URL}/api/projects`;
    const projectData = { name, description };

    log(`Calling Gateway: ${gatewayEndpoint}`);
    // log(`Sending data: ${JSON.stringify(projectData)}`); 

    // 6. Call the API Gateway endpoint with the signed token
    const response = await fetch(gatewayEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${signedApiToken}` // Add the signed token
      },
      body: JSON.stringify(projectData),
    });

    log(`Gateway response status: ${response.status}`);

    // 7. Process the response from the API Gateway
    const responseData = await response.json();

    if (!response.ok) {
      logError(`Error from Gateway (${response.status}):`, responseData);
      const status = response.status || 500;
      return NextResponse.json(
        { status: 'error', message: responseData.detail || responseData.message || 'Failed to create project via gateway' },
        { status: status }
      );
    }
    
    log(`Successfully created project via Gateway.`);
    return NextResponse.json(responseData, { status: response.status }); 

  } catch (error: any) {
    // Catch fetch errors or other unexpected errors
    logError('Unexpected error in POST handler:', error);
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error' }, { status: 500 });
  }
} 