import { NextResponse, NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
// Import shared utilities
import { GATEWAY_URL, signGatewayToken, createLogger } from '@/lib/api-utils';

// Create a logger instance for this specific route
const logger = createLogger("Frontend API /api/projects/[id]/interviews");

// GET Handler to fetch interviews for a specific project
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } } // Destructure params to get project id
) {
  // Access params IMMEDIATELY
  const projectId = params.id;
  logger.log(`Handling GET request for interviews, project ID: ${projectId}`);

  if (!projectId) {
    logger.error("GET Bad Request: Project ID somehow missing after route match.");
    return NextResponse.json({ status: 'error', message: 'Project ID is required' }, { status: 400 });
  }

  // 1. Await token retrieval
  const decodedTokenPayload = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Check token
  if (!decodedTokenPayload || !decodedTokenPayload.sub) {
    logger.error("GET Unauthorized: No valid token payload or sub claim found.");
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }
  const userId = decodedTokenPayload.sub;
  logger.log(`Authenticated user for project ${projectId} interviews: ${userId}`);

  // 2. Sign Gateway Token (using imported function)
  const signedApiToken = await signGatewayToken(userId, decodedTokenPayload.name, decodedTokenPayload.email);
  if (!signedApiToken) {
    return NextResponse.json({ status: 'error', message: 'Failed to prepare authentication token' }, { status: 500 });
  }

  try {
    // 3. Prepare request to the API Gateway
    const gatewayEndpoint = `${GATEWAY_URL}/api/projects/${projectId}/interviews`;
    logger.log(`Calling Gateway (GET): ${gatewayEndpoint}`);

    // 4. Call API Gateway
    const response = await fetch(gatewayEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${signedApiToken}`,
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    logger.log(`Gateway GET response status: ${response.status}`);

    // 5. Process Gateway Response
    const responseData = await response.json();

    if (!response.ok) {
      logger.error(`Error from Gateway (GET ${response.status}) for project ${projectId} interviews:`, responseData);
      const status = response.status || 500;
      return NextResponse.json(
        { status: 'error', message: responseData.detail || responseData.message || `Failed to fetch interviews for project ${projectId}` },
        { status: status }
      );
    }

    logger.log(`Successfully fetched interviews for project ${projectId} via Gateway.`);
    // Forward the exact response
    return NextResponse.json(responseData, { status: response.status });

  } catch (error: any) {
    logger.error(`Unexpected error in GET handler for project ${projectId} interviews:`, error);
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error' }, { status: 500 });
  }
} 