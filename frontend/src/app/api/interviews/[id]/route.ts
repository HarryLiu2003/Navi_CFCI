import { NextRequest, NextResponse } from 'next/server';

// Get the database API URL from environment variables
const DATABASE_API_URL = process.env.DATABASE_API_URL || 'http://localhost:5001';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Get the interview ID from the route params and await it
    const params = await context.params;
    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { status: 'error', message: 'Interview ID is required' },
        { status: 400 }
      );
    }
    
    // Add retry logic for fetch operations
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let lastError: Error | null = null;
    
    while (retryCount < MAX_RETRIES) {
      try {
        // Query the database API with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout
        
        const response = await fetch(`${DATABASE_API_URL}/interviews/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          cache: 'no-store' // Disable caching to ensure fresh data
        });
        
        clearTimeout(timeoutId);
        
        if (response.status === 404) {
          return NextResponse.json(
            { status: 'error', message: 'Interview not found' },
            { status: 404 }
          );
        }
        
        if (!response.ok) {
          throw new Error(`Database API returned ${response.status}`);
        }
        
        const data = await response.json();
        return NextResponse.json(data);
      } catch (error) {
        lastError = error as Error;
        retryCount++;
        
        if (retryCount === MAX_RETRIES) {
          console.error(`Failed to fetch interview after ${MAX_RETRIES} attempts:`, error);
          return NextResponse.json(
            { 
              status: 'error', 
              message: 'Failed to fetch interview',
              error: process.env.NODE_ENV === 'development' ? lastError.message : undefined
            },
            { status: 500 }
          );
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }
  } catch (error) {
    console.error('Error in interview route handler:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
} 