import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getToken } from 'next-auth/jwt';

// Get the API Gateway URL from environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const IS_DEVELOPMENT = process.env.NEXT_PUBLIC_ENV !== 'production';

// Helper function for logging
const logPrefix = "[Frontend API /api/interviews/[id]]";
const log = (...args: any[]) => console.log(logPrefix, ...args);
const logError = (...args: any[]) => console.error(logPrefix, ...args);
const logWarn = (...args: any[]) => console.warn(logPrefix, ...args);

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  log("GET request received");
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    
    log("Session data:", session ? JSON.stringify(session, null, 2) : "No session");
    
    // Get the raw cookie header for debugging
    const cookieHeader = request.headers.get('cookie');
    log("Cookie header:", cookieHeader);
    
    // Return error if not authenticated
    if (!session || !session.user || !session.user.id) {
      logError("No authenticated user session found");
      return NextResponse.json(
        { status: 'error', message: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const currentUserId = session.user.id;
    log("Authenticated User ID:", currentUserId);

    // Get the interview ID from the route params and await it
    const params = await context.params;
    const { id } = params;
    
    if (!id) {
       logError("Interview ID is required but missing from context");
      return NextResponse.json(
        { status: 'error', message: 'Interview ID is required' },
        { status: 400 }
      );
    }
    
    log(`Fetching interview details for ID: ${id}`);
    log(`Target API URL: ${API_URL}`);
    log(`Environment: ${IS_DEVELOPMENT ? 'Development' : 'Production'}`);
    
    // Add retry logic for fetch operations
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let lastError: Error | null = null;
    
    while (retryCount < MAX_RETRIES) {
      try {
        log(`Attempt ${retryCount + 1} of ${MAX_RETRIES}`);
        
        // Get the auth token to pass to the API Gateway
        const token = await getToken({ 
          req: request as any,
          secret: process.env.NEXTAUTH_SECRET, // Ensure secret is passed
          // Note: secureCookie option might be needed depending on deployment
          secureCookie: process.env.NODE_ENV === "production"
        });
        
        log("NextAuth token data:", token ? JSON.stringify(token, null, 2) : "No token found via getToken");
        
        // Prepare headers with authentication
        let headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        let authMethod = "None";
        
        // Prioritize JWT token if available
        if (token?.sub) { // Using 'sub' as the primary identifier
          headers['Authorization'] = `Bearer ${JSON.stringify(token)}`; // Send the whole token object if needed by backend
          authMethod = `JWT (sub: ${token.sub})`;
        } else if (token?.token) { // Legacy or alternative token field
           headers['Authorization'] = `Bearer ${token.token}`;
           authMethod = "JWT (token field)";
        } else if (session.user?.id) {
          // Fallback to direct user ID from session if token is missing/invalid
          headers['Authorization'] = `Bearer ${session.user.id}`;
          authMethod = `Direct User ID (Session Fallback: ${session.user.id})`;
        } else if (IS_DEVELOPMENT) {
          // Development-only fallback header
          headers['X-Development-Auth'] = 'true';
          authMethod = "Development Header Fallback";
        }
        
        log(`Selected Auth Method: ${authMethod}`);
        
        // Always include X-User-ID header for potential backend use/debugging
        headers['X-User-ID'] = currentUserId;
        log(`Added X-User-ID header: ${currentUserId}`);
        
        // Pass cookies manually if available (might be needed in some edge cases)
        if (cookieHeader) {
          headers['Cookie'] = cookieHeader;
          log('Forwarded cookie header from request');
        }
        
        log("Final request headers to API Gateway:", JSON.stringify(headers, null, 2));
        
        // Query the API Gateway with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout to 15s
        
        // Forward the request to the API Gateway
        const apiUrl = `${API_URL}/api/interviews/${id}`;
        log(`Making request to: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers,
          signal: controller.signal,
          credentials: 'include', // Include cookies
          cache: 'no-store',      // Disable caching
          next: { revalidate: 0 } // Force dynamic rendering
        });
        
        clearTimeout(timeoutId);
        
        log(`Response status from API Gateway: ${response.status}`);
        
        // Convert headers to a plain object to log them
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        log(`Response headers from API Gateway: ${JSON.stringify(responseHeaders, null, 2)}`);
        
        if (response.status === 404) {
            logError("API Gateway returned 404 - Interview not found");
          return NextResponse.json(
            { status: 'error', message: 'Interview not found' },
            { status: 404 }
          );
        }
        
        if (response.status === 403) {
            logError("API Gateway returned 403 - Not authorized");
          return NextResponse.json(
            { status: 'error', message: 'Not authorized to access this interview' },
            { status: 403 }
          );
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          logError(`API Gateway error (${response.status}): ${errorText}`);
          // Create a more informative error message
          throw new Error(`API Gateway call failed with status ${response.status}. Response: ${errorText}`);
        }
        
        const data = await response.json();
        log("Successfully fetched and parsed interview data");
        return NextResponse.json(data);
        
      } catch (error: any) {
        lastError = error;
        retryCount++;
        logError(`Attempt ${retryCount} failed: ${error.message}`);
        
        // Wait before retrying (exponential backoff)
        if (retryCount < MAX_RETRIES) {
          const delay = Math.pow(2, retryCount) * 200; // Increased backoff delay
          log(`Waiting ${delay}ms before next retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    const finalErrorMessage = `Failed to fetch interview after ${MAX_RETRIES} attempts. Last error: ${lastError?.message || 'Unknown error'}`;
    logError(finalErrorMessage);
    return NextResponse.json(
      { 
        status: 'error', 
        message: finalErrorMessage
      },
      { status: 500 }
    );
    
  } catch (error: any) {
    logError('Unexpected error in GET handler:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Internal server error fetching interview details' },
      { status: 500 }
    );
  }
} 