import { NextRequest, NextResponse } from 'next/server';
// Use getToken instead of getServerSession for getting payload to sign
import { getToken } from "next-auth/jwt"; 
// Import authOptions from the correct path
import { authOptions } from "../auth/[...nextauth]/route"; 
// Import jose for manual signing
import * as jose from 'jose'; 
import { API_CONFIG } from "@/lib/api"; 

// Determine Gateway URL based on environment
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';
const API_URL_FROM_ENV = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'; // Fallback for safety
const gatewayUrlBase = IS_DEVELOPMENT ? "http://api_gateway:8000" : API_URL_FROM_ENV;

// --- Logging Setup (using console for now) ---
const logPrefix = "[/api/create-persona]";
const log = (...args: any[]) => console.log(logPrefix, ...args);
const logError = (...args: any[]) => console.error(logPrefix, ...args);

// Helper function to log and create error responses
const logAndRespond = (message: string, status: number, error?: any) => {
  logError(message, error ? { error: error.message || error } : {});
  return NextResponse.json({ status: 'error', message }, { status });
};

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

export async function POST(request: NextRequest) {
  log("POST request received");

  // 1. Get Decoded Token Payload (Authentication Check)
  let decodedTokenPayload: any = null;
  try {
      decodedTokenPayload = await getToken({
          req: request as any,
          secret: process.env.NEXTAUTH_SECRET,
          secureCookie: process.env.NODE_ENV === "production"
      });
  } catch (tokenError) {
      return logAndRespond("Error retrieving authentication token.", 500, tokenError);
  }
  if (!decodedTokenPayload || !decodedTokenPayload.sub) {
      return logAndRespond("Unauthorized: Invalid or missing token payload.", 401, decodedTokenPayload);
  }
  const userId = decodedTokenPayload.sub; // Use 'sub' as userId
  log(`Authenticated user: ${userId}`);

  // 2. Parse Request Body
  let requestBody;
  try {
    requestBody = await request.json();
  } catch (e) {
    return logAndRespond("Invalid request body: Could not parse JSON.", 400, e);
  }

  const { name, color } = requestBody;
  if (!name || typeof name !== 'string' || name.trim().length === 0 || !color || typeof color !== 'string' || color.trim().length === 0) {
    return logAndRespond(
      "Invalid request body: 'name' (string) and 'color' (string) are required.", 
      400
    );
  }

  // 3. Prepare data for API Gateway
  const gatewayPayload = {
    name: name.trim(),
    color: color.trim(),
    userId: userId 
  };

  // 4. Manually Sign a *NEW* JWS Token for API Gateway
  if (!signingKey) {
      return logAndRespond("Internal Server Error: Signing key not available.", 500);
  }
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
      return logAndRespond("Internal Server Error: Failed to prepare authentication token.", 500, signingError);
  }

  // 5. Forward Request to API Gateway
  const gatewayUrl = `${gatewayUrlBase}/api/personas`;
  log(`Forwarding POST request to API Gateway: ${gatewayUrl}`);
  
  try {
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${signedApiToken}`, // Use manually signed token
        'Accept': 'application/json'
      },
      body: JSON.stringify(gatewayPayload),
    });

    log(`Received response status from API Gateway: ${response.status}`);

    let responseData;
    try {
        responseData = await response.json();
    } catch (jsonError) {
        logError("Failed to parse JSON response from API Gateway.", jsonError);
        if (!response.ok) {
            return logAndRespond(`API Gateway Error (${response.status}): ${response.statusText || 'Unknown error'}`, response.status);
        }
        responseData = { status: 'success', message: 'Operation successful but no content returned.' }; 
    }

    if (!response.ok || responseData.status !== 'success') {
      const errorMessage = responseData.message || responseData.detail || `API Gateway returned status ${response.status}`;
      logError(`API Gateway error (${response.status}): ${JSON.stringify(responseData)}`);
      const errorStatus = response.status >= 400 ? response.status : 502; 
      return NextResponse.json({ status: 'error', message: errorMessage }, { status: errorStatus });
    }
    
    log(`Successfully created persona via Gateway:`, responseData.data);
    return NextResponse.json(responseData, { status: response.status });

  } catch (error) {
    return logAndRespond("Internal Server Error: Failed to communicate with API Gateway.", 500, error);
  }
} 