import { NextResponse, NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';
import * as jose from 'jose';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// --- Use environment-aware Gateway URL and logging from problem-areas example --- 
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const gatewayUrl = IS_DEVELOPMENT ? "http://api_gateway:8000" : API_URL;

const jwtSecret = process.env.NEXTAUTH_SECRET;
const signingKey = jwtSecret ? new TextEncoder().encode(jwtSecret) : null;

// Simplified logging function
const log = (...messages: any[]) => console.log("[API Route /api/projects/[id]]", ...messages);
const logError = (...messages: any[]) => console.error("[API Route ERROR /api/projects/[id]]", ...messages);

/**
 * Generates a short-lived JWS token for API Gateway authentication.
 */
async function generateApiToken(userPayload: any): Promise<string | null> { // Return null on error
  if (!signingKey) { 
    logError('JWT secret is not configured for signing.');
    return null; // Indicate failure
  }
  try {
      const token = await new jose.SignJWT({
          sub: userPayload.sub, 
          name: userPayload.name, 
          email: userPayload.email, 
      })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m') 
      .sign(signingKey);
      return token;
  } catch (error) {
      logError('Failed to sign gateway token:', error);
      return null; // Indicate failure
  }
}

// GET Handler (Keep existing logic, but ensure it uses consistent auth/logging if needed)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } } 
) {
  const projectId = params.id; 
  log(`Handling GET request for project ID: ${projectId}`);
  
  if (!projectId) {
    logError("GET Bad Request: Project ID missing.");
    return NextResponse.json({ status: 'error', message: 'Project ID is required' }, { status: 400 });
  }
  if (!gatewayUrl || !signingKey) {
    logError('GET Config Error: API Gateway URL or JWT Signing Key not configured.');
    return NextResponse.json({ status: 'error', message: 'Internal server configuration error.' }, { status: 500 });
  }

  // 1. Check session first
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
      logError("GET Unauthorized: No active session.");
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }

  // 2. Get token payload for signing
  const decodedTokenPayload = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!decodedTokenPayload || !decodedTokenPayload.sub) {
    logError("GET Unauthorized: No valid token payload or sub claim found.");
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }
  const userId = decodedTokenPayload.sub;
  log(`Authenticated user for GET project ${projectId}: ${userId}`);

  // 3. Generate API token
  const signedApiToken = await generateApiToken(decodedTokenPayload);
  if (!signedApiToken) {
    return NextResponse.json({ status: 'error', message: 'Failed to prepare authentication token' }, { status: 500 });
  }

  try {
    // 4. Prepare request to the API Gateway
    const gatewayEndpoint = `${gatewayUrl}/api/projects/${projectId}`;
    log(`Calling Gateway (GET): ${gatewayEndpoint}`);

    // 5. Call the API Gateway endpoint
    const response = await fetch(gatewayEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${signedApiToken}`,
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    log(`Gateway GET response status: ${response.status}`);
    const responseData = await response.json(); // Parse JSON regardless of status

    // 6. Process the response
    if (!response.ok) {
      logError(`Error from Gateway (GET ${response.status}) for project ${projectId}:`, responseData);
      return NextResponse.json(
        { status: 'error', message: responseData.detail || responseData.message || `Failed to fetch project ${projectId} via gateway` },
        { status: response.status } // Use gateway's status code
      );
    }

    log(`Successfully fetched project ${projectId} via Gateway.`);
    return NextResponse.json(responseData, { status: response.status });

  } catch (error: any) {
    logError(`Unexpected error in GET handler for project ${projectId}:`, error);
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error' }, { status: 500 });
  }
}

// --- REVISED PUT Handler --- //
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;
  log(`Handling PUT request for project ID: ${projectId}`);

  if (!projectId) {
    logError("PUT Bad Request: Project ID missing.");
    return NextResponse.json({ status: 'error', message: 'Project ID is required' }, { status: 400 });
  }
  if (!gatewayUrl || !signingKey) {
    logError('PUT Config Error: API Gateway URL or JWT Signing Key not configured.');
    return NextResponse.json({ status: 'error', message: 'Internal server configuration error.' }, { status: 500 });
  }

  // 1. Check session first
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
      logError("PUT Unauthorized: No active session.");
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }
  
  // 2. Get token payload for signing API token
  const decodedTokenPayload = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!decodedTokenPayload || !decodedTokenPayload.sub) {
    logError("PUT Unauthorized: Invalid token.");
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }
  const userId = decodedTokenPayload.sub;
  log(`Authenticated user for PUT project ${projectId}: ${userId}`);

  try {
    // 3. Get update data from request body
    const body = await request.json();
    const { name, description } = body;

    // Basic validation (should match Pydantic model on gateway)
    if (name === undefined && description === undefined) {
      logError("PUT Bad Request: Missing name or description in body.");
      return NextResponse.json({ status: 'error', message: 'Request body must contain name or description' }, { status: 400 });
    }

    // 4. Generate API token
    const signedApiToken = await generateApiToken(decodedTokenPayload);
     if (!signedApiToken) {
        return NextResponse.json({ status: 'error', message: 'Failed to prepare authentication token' }, { status: 500 });
    }

    // 5. Prepare request to API Gateway
    const gatewayEndpoint = `${gatewayUrl}/api/projects/${projectId}`;
    log(`Calling Gateway (PUT): ${gatewayEndpoint} with body:`, body);

    // 6. Call API Gateway
    const response = await fetch(gatewayEndpoint, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${signedApiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body), // Send validated body
    });

    log(`Gateway PUT response status: ${response.status}`);
    // Attempt to parse JSON, handle potential errors if body is empty or not JSON
    let responseData;
    try {
        responseData = await response.json();
    } catch (parseError) {
        // If parsing fails (e.g., empty body on success), check response.ok
        if (response.ok) {
            log(`Gateway PUT for project ${projectId} successful (${response.status}), but no JSON body.`);
            // Return a standard success response if appropriate
            return NextResponse.json({ status: 'success', message: 'Project updated successfully (no content)' }, { status: response.status }); 
        } else {
            // If not ok and not parsable, return generic error
            logError(`Gateway PUT for project ${projectId} failed (${response.status}) with non-JSON body.`);
            responseData = { detail: `Gateway error (${response.status}) with non-JSON response.` }; 
        }
    }

    // 7. Process response
    if (!response.ok) {
      logError(`Error from Gateway (PUT ${response.status}) for project ${projectId}:`, responseData);
      return NextResponse.json(
        { status: 'error', message: responseData.detail || responseData.message || `Failed to update project ${projectId} via gateway` },
        { status: response.status } // Use gateway's status code
      );
    }

    log(`Successfully updated project ${projectId} via Gateway.`);
    return NextResponse.json(responseData, { status: response.status }); // Forward success response

  } catch (error: any) {
    logError(`Unexpected error in PUT handler for project ${projectId}:`, error);
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error during update' }, { status: 500 });
  }
}

// --- REVISED DELETE Handler --- //
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;
  log(`Handling DELETE request for project ID: ${projectId}`);

  if (!projectId) {
    logError("DELETE Bad Request: Project ID missing.");
    return NextResponse.json({ status: 'error', message: 'Project ID is required' }, { status: 400 });
  }
   if (!gatewayUrl || !signingKey) {
    logError('DELETE Config Error: API Gateway URL or JWT Signing Key not configured.');
    return NextResponse.json({ status: 'error', message: 'Internal server configuration error.' }, { status: 500 });
  }

  // 1. Check session first
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    logError("DELETE Unauthorized: No active session.");
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }
  
  // 2. Get token payload for signing API token
  const decodedTokenPayload = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!decodedTokenPayload || !decodedTokenPayload.sub) {
    logError("DELETE Unauthorized: Invalid token.");
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }
  const userId = decodedTokenPayload.sub;
  log(`Authenticated user for DELETE project ${projectId}: ${userId}`);

  try {
    // 3. Generate API token
    const signedApiToken = await generateApiToken(decodedTokenPayload);
    if (!signedApiToken) {
        return NextResponse.json({ status: 'error', message: 'Failed to prepare authentication token' }, { status: 500 });
    }

    // ---- START: Read force parameter ----
    const forceParam = request.nextUrl.searchParams.get('force');
    const isForceDelete = forceParam === 'true';
    log(`Force delete requested: ${isForceDelete}`);
    // ---- END: Read force parameter ----

    // 4. Prepare request to API Gateway, including force param if needed
    let gatewayEndpoint = `${gatewayUrl}/api/projects/${projectId}`;
    if (isForceDelete) {
      gatewayEndpoint += '?force=true';
    }
    log(`Calling Gateway (DELETE): ${gatewayEndpoint}`);

    // 5. Call API Gateway
    const response = await fetch(gatewayEndpoint, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${signedApiToken}`,
        'Accept': 'application/json'
      },
    });

    log(`Gateway DELETE response status: ${response.status}`);

    // 6. Process response
    // Handle 204 No Content success case explicitly FIRST
    if (response.status === 204) {
        log(`Successfully deleted project ${projectId} via Gateway (204 No Content).`);
        return new NextResponse(null, { status: 204 }); 
    }
    
    // For ALL OTHER responses (including success with body or errors), try parsing JSON
    let responseData;
    try {
        responseData = await response.json();
    } catch (parseError) {
        // If parsing fails and it wasn't a 204, something is wrong
        logError(`Gateway DELETE for project ${projectId} returned status ${response.status} with non-JSON body.`);
        // Return a generic error based on the status code if parsing failed
        const message = response.ok ? 'Delete successful but response unreadable' : `Gateway error (${response.status}) with non-JSON response.`;
        return NextResponse.json({ status: response.ok ? 'success' : 'error', message }, { status: response.status }); 
    }

    // If JSON parsing succeeded, check if the response was OK
    if (!response.ok) {
      logError(`Error from Gateway (DELETE ${response.status}) for project ${projectId}:`, responseData);
      return NextResponse.json(
        { status: 'error', message: responseData.detail || responseData.message || `Failed to delete project ${projectId} via gateway` },
        { status: response.status } // Use gateway's status code
      );
    }

    // If response.ok and JSON was parsed (e.g., 200 OK with deleted object)
    log(`Successfully deleted project ${projectId} via Gateway (Status: ${response.status}).`);
    return NextResponse.json(responseData, { status: response.status }); // Forward success response

  } catch (error: any) {
    logError(`Unexpected error in DELETE handler for project ${projectId}:`, error);
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error during delete' }, { status: 500 });
  }
} 