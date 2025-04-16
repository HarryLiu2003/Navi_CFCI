import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
// Import shared utilities
import { GATEWAY_URL, signGatewayToken, createLogger } from '@/lib/api-utils';

// Create logger instance
const logger = createLogger("API Route /api/problem-areas/[id]/confirm");

// --- PATCH Handler (Confirm/Unconfirm Problem Area) ---
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  // Access params IMMEDIATELY
  const problemAreaId = params.id;
  logger.log(`Handling PATCH request for confirm, problem area ID: ${problemAreaId}`);

  if (!problemAreaId) {
    logger.error("PATCH Bad Request: Problem Area ID somehow missing after route match.");
    return NextResponse.json({ status: 'error', message: 'Problem Area ID is required' }, { status: 400 });
  }

  // 1. Await token retrieval FIRST
  const session = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  
  logger.log(`PATCH /api/problem-areas/${problemAreaId}/confirm called`); // Use logger

  if (!GATEWAY_URL) { // Use imported constant
    logger.error("API Gateway URL is not configured.");
    return NextResponse.json({ status: 'error', message: 'Internal server configuration error (gateway)' }, { status: 500 });
  }
  // Signing key availability checked within signGatewayToken

  // 2. Session Check (use awaited session)
  if (!session || !session.sub) {
    logger.error("Unauthorized: No valid session or user ID found.");
    return NextResponse.json({ status: 'error', message: 'Authentication required' }, { status: 401 });
  }
  const userId = session.sub;

  // 3. Get Request Body
  let body: any;
  try {
    body = await req.json();
    logger.log("Request body parsed:", body);
  } catch (e) {
    logger.error("Failed to parse request body:", e);
    return NextResponse.json({ status: 'error', message: 'Invalid request body' }, { status: 400 });
  }
  const { isConfirmed, priority } = body; 
  if (typeof isConfirmed !== 'boolean') {
    return NextResponse.json({ status: 'error', message: 'isConfirmed (boolean) is required in body' }, { status: 400 });
  }

  // 4. Prepare Gateway Token (use awaited session and imported function)
  const gatewayToken = await signGatewayToken(userId, session.name, session.email);
  if (!gatewayToken) {
    // Error already logged by signGatewayToken
    return NextResponse.json({ message: "Failed to prepare authentication token" }, { status: 500 });
  }

  // 5. Call API Gateway
  const gatewayEndpoint = `${GATEWAY_URL}/api/problem_areas/${problemAreaId}/confirm`; // Use imported constant
  const queryParams = new URLSearchParams({ userId }); // Pass userId as query param for auth check in DB service
  logger.log(`Forwarding PATCH to Gateway: ${gatewayEndpoint}?${queryParams}`);
  try {
    const response = await fetch(`${gatewayEndpoint}?${queryParams}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${gatewayToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        isConfirmed,
        ...(priority !== undefined && { priority })
      }),
      cache: 'no-store',
    });

    // 6. Process Response
    const responseData = await response.json();
    logger.log(`Received response from Gateway (${response.status})`);

    if (!response.ok) {
       logger.error(`API Gateway error (${response.status}):`, responseData);
      return NextResponse.json(
        { status: 'error', message: responseData.message || responseData.detail || 'Failed to update confirmation status via gateway.' }, 
        { status: response.status }
      );
    }

    return NextResponse.json(responseData, { status: response.status }); // Forward success

  } catch (error: any) {
     logger.error(`Error during fetch to Gateway:`, error);
     return NextResponse.json({ status: 'error', message: error.message || 'Internal server error during gateway call.' }, { status: 500 });
  }
}
