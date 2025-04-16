import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getToken } from 'next-auth/jwt';
import * as jose from 'jose';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as needed

// Environment-aware Gateway URL
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const gatewayUrl = IS_DEVELOPMENT ? "http://api_gateway:8000" : API_URL;

const jwtSecret = process.env.NEXTAUTH_SECRET;
const signingKey = jwtSecret ? new TextEncoder().encode(jwtSecret) : null;

// Simplified logging function
const log = (...messages: any[]) => console.log("[API Route /api/problem-areas/[id]]", ...messages);
const logError = (...messages: any[]) => console.error("[API Route ERROR /api/problem-areas/[id]]", ...messages);

/**
 * Generates a short-lived JWS token for API Gateway authentication.
 */
async function generateApiToken(userPayload: any): Promise<string> {
  if (!signingKey) { // Check signingKey directly
    throw new Error('JWT secret is not configured for signing.');
  }
  const token = await new jose.SignJWT({
      sub: userPayload.sub, 
      name: userPayload.name, 
      email: userPayload.email, 
  })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('5m') 
  .sign(signingKey); // Use the prepared signingKey
  return token;
}

// --- PUT Handler (Update Problem Area) ---
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const problemAreaId = params.id;
  log(`PUT /api/problem-areas/${problemAreaId} called`);
  
  if (!gatewayUrl || !signingKey) {
    logError('API Gateway URL or JWT Signing Key not configured.');
    return NextResponse.json({ status: 'error', message: 'Internal server configuration error.' }, { status: 500 });
  }

  // 1. Check authentication
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized: No active session.' }, { status: 401 });
  }
  
  // 2. Get token payload for signing API token
  const tokenPayload = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, secureCookie: !IS_DEVELOPMENT });
  if (!tokenPayload || !tokenPayload.sub) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized: Invalid token.' }, { status: 401 });
  }

  try {
    // 3. Get request body
    const body = await req.json();
    const { title, description } = body;

    if (title === undefined && description === undefined) {
       return NextResponse.json({ status: 'error', message: 'No fields provided for update (title, description).' }, { status: 400 });
    }

    // 4. Generate API token
    const apiToken = await generateApiToken(tokenPayload);

    // 5. Forward request to API Gateway (using conditional gatewayUrl)
    const targetUrl = `${gatewayUrl}/api/problem_areas/${problemAreaId}`;
    log(`Forwarding PUT to Gateway: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, description }),
    });

    // 6. Process response
    const responseData = await response.json();
    log(`Received response from Gateway (${response.status}):`, responseData);

    if (!response.ok) {
      return NextResponse.json(
        { status: 'error', message: responseData.message || responseData.detail || 'Failed to update problem area via gateway.' }, 
        { status: response.status }
      );
    }

    return NextResponse.json(responseData, { status: response.status });

  } catch (error: any) {
    logError(`PUT /api/problem-areas/${problemAreaId}:`, error);
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error.' }, { status: 500 });
  }
}

// --- DELETE Handler (Delete Problem Area) ---
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const problemAreaId = params.id;
  log(`DELETE /api/problem-areas/${problemAreaId} called`);
  
  if (!gatewayUrl || !signingKey) {
    logError('API Gateway URL or JWT Signing Key not configured.');
    return NextResponse.json({ status: 'error', message: 'Internal server configuration error.' }, { status: 500 });
  }

  // 1. Check authentication
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized: No active session.' }, { status: 401 });
  }
  
  // 2. Get token payload for signing API token
  const tokenPayload = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, secureCookie: !IS_DEVELOPMENT });
  if (!tokenPayload || !tokenPayload.sub) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized: Invalid token.' }, { status: 401 });
  }

  try {
    // 3. Generate API token
    const apiToken = await generateApiToken(tokenPayload);

    // 4. Forward request to API Gateway (using conditional gatewayUrl)
    const targetUrl = `${gatewayUrl}/api/problem_areas/${problemAreaId}`;
    log(`Forwarding DELETE to Gateway: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    });

    // 5. Process response
    const responseData = await response.json(); 
    log(`Received response from Gateway (${response.status}):`, responseData);

    if (!response.ok) {
       return NextResponse.json(
        { status: 'error', message: responseData.message || responseData.detail || 'Failed to delete problem area via gateway.' }, 
        { status: response.status }
      );
    }

    return NextResponse.json(responseData, { status: response.status });

  } catch (error: any) {
    logError(`DELETE /api/problem-areas/${problemAreaId}:`, error);
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error.' }, { status: 500 });
  }
} 