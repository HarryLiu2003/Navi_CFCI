import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getToken } from 'next-auth/jwt';
import * as jose from 'jose';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as needed
import { GATEWAY_URL, signGatewayToken, createLogger } from '@/lib/api-utils';

// Environment-aware Gateway URL
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const gatewayUrl = IS_DEVELOPMENT ? "http://api_gateway:8000" : API_URL;

const jwtSecret = process.env.NEXTAUTH_SECRET;
const signingKey = jwtSecret ? new TextEncoder().encode(jwtSecret) : null;

// Create a logger instance
const logger = createLogger("API Route /api/interviews/[id]");

// Simplified logging function
const log = (...messages: any[]) => console.log("[API Route /api/interviews/[id]]", ...messages);
const logError = (...messages: any[]) => console.error("[API Route ERROR /api/interviews/[id]]", ...messages);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Access params IMMEDIATELY
  const interviewId = params.id;
  logger.log(`Handling GET request for interview ID: ${interviewId}`);

  if (!interviewId) {
    logger.error("GET Bad Request: Interview ID somehow missing after route match.");
    return NextResponse.json({ status: 'error', message: 'Interview ID is required' }, { status: 400 });
  }
  
  // 1. Await token retrieval
  const session = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  
  logger.log(`GET request received for ID: ${interviewId}`);

  try {
    // 1. Session Check (use awaited session)
    if (!session || !session.sub) {
      logger.error('Unauthorized: No session found');
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const userId = session.sub;

    // 2. Prepare Gateway Token (use awaited session)
    const gatewayToken = await signGatewayToken(userId, session.name, session.email);
    if (!gatewayToken) {
      return NextResponse.json({ message: "Failed to prepare authentication token" }, { status: 500 });
    }

    // 3. Call API Gateway
    const gatewayEndpoint = `${GATEWAY_URL}/api/interviews/${interviewId}`;
    const queryParams = new URLSearchParams({ userId }); // Add userId as query param for DB check
    logger.log(`Forwarding request to API Gateway: ${gatewayEndpoint}?${queryParams}`);

    const response = await fetch(`${gatewayEndpoint}?${queryParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${gatewayToken}`,
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    // 4. Process Response
    const responseData = await response.json();
    logger.log(`Received response status from API Gateway: ${response.status}`);

    if (!response.ok) {
      logger.error(`API Gateway error (${response.status}):`, responseData);
      // Forward the status code and error message from the gateway
      return NextResponse.json(responseData, { status: response.status });
    }
    
    return NextResponse.json(responseData); // Success!

  } catch (error: any) {
    logger.error('Unexpected error in GET handler:', error);
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error fetching interview details' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Access params IMMEDIATELY
  const interviewId = params.id;
  logger.log(`Handling PUT request for interview ID: ${interviewId}`);
  
  if (!interviewId) {
    logger.error("PUT Bad Request: Interview ID somehow missing after route match.");
    return NextResponse.json({ status: 'error', message: 'Interview ID is required' }, { status: 400 });
  }

  // 1. Await token retrieval
  const session = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  // Now access params AFTER awaiting getToken
  logger.log(`PUT request received for ID: ${interviewId}`);

  try {
    // Session Check
    if (!session || !session.sub) {
      logger.error('Unauthorized: No session found for PUT');
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const userId = session.sub;

    // Get Update Data from Request Body
    let updateData: any;
    try {
      updateData = await request.json();
      if (!updateData || typeof updateData !== 'object') {
        logger.error("Invalid update data received. Expected JSON object.", updateData);
        return NextResponse.json({ status: 'error', message: 'Invalid request body' }, { status: 400 });
      }
    } catch (parseError) {
        logger.error("Failed to parse request body as JSON.", parseError);
        return NextResponse.json({ status: 'error', message: 'Invalid JSON body' }, { status: 400 });
    }

    // Prepare Gateway Token (using imported function)
    const gatewayToken = await signGatewayToken(userId, session.name, session.email);
    if (!gatewayToken) {
      return NextResponse.json({ message: "Failed to prepare authentication token" }, { status: 500 });
    }

    // Prepare Request to API Gateway
    const gatewayEndpoint = `${GATEWAY_URL}/api/interviews/${interviewId}`; 
    const queryParams = new URLSearchParams({ userId }); // Pass userId for auth check
    logger.log(`Forwarding PUT request to API Gateway: ${gatewayEndpoint}?${queryParams}`);

    // Make the fetch call
    const response = await fetch(`${gatewayEndpoint}?${queryParams}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${gatewayToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(updateData),
      cache: 'no-store'
    });

    const responseData = await response.json();
    logger.log(`Received PUT response status from API Gateway: ${response.status}`);

    if (!response.ok) {
      logger.error(`API Gateway PUT error (${response.status}):`, responseData);
      return NextResponse.json(responseData, { status: response.status });
    }
    logger.log("Successfully received PUT response from API Gateway.");
    return NextResponse.json(responseData); // Forward success

  } catch (error: any) {
    logger.error('Unexpected error in PUT handler:', error);
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error updating interview' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
   // Access params IMMEDIATELY
  const interviewId = params.id;
  logger.log(`Handling DELETE request for interview ID: ${interviewId}`);
  
  if (!interviewId) {
    logger.error("DELETE Bad Request: Interview ID somehow missing after route match.");
    return NextResponse.json({ status: 'error', message: 'Interview ID is required' }, { status: 400 });
  }

  // 1. Await token retrieval
  const session = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  // Now access params AFTER awaiting getToken
  logger.log(`DELETE request received for ID: ${interviewId}`);

  try {
    // Session Check
    if (!session || !session.sub) {
      logger.error('Unauthorized: No session found for DELETE');
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const userId = session.sub;

    // Prepare Gateway Token (using imported function)
    const gatewayToken = await signGatewayToken(userId, session.name, session.email);
    if (!gatewayToken) {
      return NextResponse.json({ message: "Failed to prepare authentication token" }, { status: 500 });
    }

    // Prepare Request to API Gateway
    const gatewayEndpoint = `${GATEWAY_URL}/api/interviews/${interviewId}`; 
    const queryParams = new URLSearchParams({ userId }); // Pass userId for auth check
    logger.log(`Forwarding DELETE request to API Gateway: ${gatewayEndpoint}?${queryParams}`);

    // Make the fetch call
    const response = await fetch(`${gatewayEndpoint}?${queryParams}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${gatewayToken}`,
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    const responseStatus = response.status;
    // Attempt to parse JSON, but handle cases where DELETE might return no content (204)
    let responseData: any = {}; 
    try {
      if (response.body) { // Check if there's a body to parse
         responseData = await response.json(); 
      }
    } catch (jsonError) {
      // Ignore JSON parsing error if status indicates success (like 204)
      if (responseStatus < 200 || responseStatus >= 300) {
        logger.error(`Failed to parse JSON response for DELETE status ${responseStatus}:`, jsonError);
        // You might want to return the original error or a generic one
      } else {
        logger.log(`DELETE request successful with status ${responseStatus}, no JSON body returned.`);
      }
    }

    logger.log(`Received DELETE response status from API Gateway: ${responseStatus}`);

    if (!response.ok) {
      logger.error(`API Gateway DELETE error (${responseStatus}):`, responseData);
      // Ensure responseData is at least an empty object if parsing failed
      return NextResponse.json(responseData || { message: `Failed with status ${responseStatus}` }, { status: responseStatus }); 
    }
    logger.log("Successfully received DELETE success response from API Gateway.");
    // Forward success, potentially with data if DB service returned it, or just status
    return NextResponse.json(responseData, { status: responseStatus }); 

  } catch (error: any) {
    logger.error('Unexpected error in DELETE handler:', error);
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error during delete' }, { status: 500 });
  }
} 