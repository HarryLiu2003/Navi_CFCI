import { NextRequest, NextResponse } from 'next/server';

// Get the database API URL from environment variables
const DATABASE_API_URL = process.env.DATABASE_API_URL || 'http://localhost:5001';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the interview ID from the route params
    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { status: 'error', message: 'Interview ID is required' },
        { status: 400 }
      );
    }
    
    // Query the database API
    const response = await fetch(`${DATABASE_API_URL}/interviews/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.status === 404) {
      return NextResponse.json(
        { status: 'error', message: 'Interview not found' },
        { status: 404 }
      );
    }
    
    if (!response.ok) {
      throw new Error(`Database API returned ${response.status}`);
    }
    
    // Forward the response
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching interview:', error);
    
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Failed to fetch interview' 
      },
      { status: 500 }
    );
  }
} 