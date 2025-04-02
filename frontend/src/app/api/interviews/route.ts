import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

/**
 * This API route acts as a proxy to the database service which connects to Supabase.
 * It retrieves a paginated list of interviews from the Supabase database.
 * 
 * This endpoint accepts the following query parameters:
 * - limit: number of interviews to return (default: 10)
 * - offset: number of interviews to skip (default: 0)
 */

// Get the database API URL from environment variables
// This should point to the database service which connects to Supabase
const DATABASE_API_URL = process.env.DATABASE_API_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    
    // Return empty results if not authenticated
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({
        status: 'success',
        message: 'No authenticated user',
        data: { interviews: [], total: 0, limit: 0, offset: 0, hasMore: false }
      });
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') || '10';
    const offset = searchParams.get('offset') || '0';
    const userId = session.user.id;
    
    // Query the database API which connects to Supabase with user filter
    const response = await fetch(`${DATABASE_API_URL}/interviews?limit=${limit}&offset=${offset}&userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Database API returned ${response.status}`);
    }
    
    // Forward the response
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching interviews:', error);
    
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Failed to fetch interviews' 
      },
      { status: 500 }
    );
  }
} 