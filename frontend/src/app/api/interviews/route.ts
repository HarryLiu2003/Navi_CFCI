import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getToken } from 'next-auth/jwt';

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
const IS_DEVELOPMENT = process.env.NEXT_PUBLIC_ENV !== 'production';

export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    
    // Return error if not authenticated
    if (!session || !session.user || !session.user.id) {
      console.log("No authenticated user session found");
      return NextResponse.json(
        { status: 'error', message: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get pagination parameters from URL
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') || '10';
    const offset = url.searchParams.get('offset') || '0';
    
    console.log(`Fetching interviews with limit ${limit} and offset ${offset}`);
    console.log(`API URL: ${API_URL}`);
    
    // Add retry logic for fetch operations
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let lastError: Error | null = null;
    
    // --- Add logging prefix ---
    const logPrefix = "[Frontend API /api/interviews]";
    const log = (...args: any[]) => console.log(logPrefix, ...args);
    const logError = (...args: any[]) => console.error(logPrefix, ...args);
    const logWarn = (...args: any[]) => console.warn(logPrefix, ...args);
    // --- End logging prefix ---

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
        log("Token received:", token ? "Yes" : "No");
        
        // Prepare headers with authentication
        let headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        let authMethod = "None";
        // In production, pass the actual auth token
        if (token?.token) {
          headers['Authorization'] = `Bearer ${token.token}`;
          authMethod = "Bearer Token";
        } else if (session.user?.id) {
          // Fallback to direct user ID auth
          headers['Authorization'] = `Bearer ${session.user.id}`;
           authMethod = "Bearer Session User ID";
        } else if (IS_DEVELOPMENT) {
          // In development, we can use a special header that will be recognized by the API Gateway
          headers['X-Development-Auth'] = 'true';
           authMethod = "X-Development-Auth Header";
        }
        log(`Auth Method Selected: ${authMethod}`);
        
        // Always pass user ID as a separate header in both dev and prod
        if (session.user?.id) {
          headers['X-User-ID'] = session.user.id;
          log(`Added X-User-ID header: ${session.user.id}`);
        }
        
        // --- Log headers just before fetch ---
        log("Headers sent to API Gateway:", JSON.stringify(headers));
        // --- End log headers ---

        // Query the API Gateway with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout
        
        // Forward the request to the API Gateway
        const apiUrl = `${API_URL}/api/interviews?limit=${limit}&offset=${offset}`;
        log(`Fetching from API Gateway URL: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers,
          signal: controller.signal,
          credentials: 'include', // Include cookies in the request
          cache: 'no-store', // Disable caching to ensure fresh data
          next: { revalidate: 0 } // Disable cache
        });
        
        clearTimeout(timeoutId);
        
        // --- Log response status unconditionally ---
        log(`Received response status from API Gateway: ${response.status}`);
        const responseText = await response.text(); // Read response text once
        log(`Received response text (truncated): ${responseText.substring(0, 500)}...`);
        // --- End log response ---

        if (!response.ok) {
          // Use the responseText we already read
          logError(`API Gateway error (${response.status}):`, responseText);
          throw new Error(`API Gateway returned ${response.status}: ${responseText}`);
        }
        
        // Try parsing the JSON
        try {
            const data = JSON.parse(responseText);
            log("Successfully parsed JSON response from API Gateway.");
            return NextResponse.json(data);
        } catch(parseError) {
            logError("Failed to parse JSON response from API Gateway", parseError);
            throw new Error(`Failed to parse API Gateway response as JSON. Response text: ${responseText}`);
        }

      } catch (error: any) {
        lastError = error;
        retryCount++;
        logError(`Attempt ${retryCount} failed:`, error.message);
        
        // Wait before retrying (exponential backoff)
        if (retryCount < MAX_RETRIES) {
          const delay = Math.pow(2, retryCount) * 100;
          log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    logError(`Failed to fetch interviews after ${MAX_RETRIES} attempts`);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Failed to fetch interviews${lastError ? ` (${lastError.message})` : ''}` 
      },
      { status: 500 }
    );
    
  } catch (error: any) {
    console.error('Error fetching interviews:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Failed to fetch interviews' },
      { status: 500 }
    );
  }
} 