import { NextResponse } from 'next/server';
import { API_CONFIG } from '@/lib/api';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export async function POST(request: Request) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    
    // Return error if not authenticated
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Create a new FormData instance
    const forwardForm = new FormData();
    forwardForm.append('file', file);
    
    // Add user ID to the request - this ensures it's always included
    // even if client doesn't send it
    forwardForm.append('userId', session.user.id);
    
    // Also add any userId that was passed in from client (should match session)
    const userId = formData.get('userId');
    if (userId && userId !== session.user.id) {
      console.warn('Client provided userId doesn\'t match session userId');
    }

    // Use the gateway to get analysis
    const analysisResponse = await fetch(
      `${API_CONFIG.API_URL}${API_CONFIG.ENDPOINTS.INTERVIEW_ANALYSIS.ANALYZE}`, 
      {
        method: 'POST',
        body: forwardForm,
      }
    );

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('Error from gateway service:', errorText);
      return NextResponse.json(
        { error: 'Failed to process transcript', details: errorText },
        { status: analysisResponse.status }
      );
    }

    // Return the response directly
    const analysisData = await analysisResponse.json();
    return NextResponse.json(analysisData);

  } catch (error) {
    console.error('Error processing transcript:', error);
    return NextResponse.json(
      { error: 'Failed to process transcript' },
      { status: 500 }
    );
  }
} 