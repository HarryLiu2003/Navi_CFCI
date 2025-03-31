import { NextResponse } from 'next/server';
import { API_CONFIG } from '@/lib/api';

export async function POST(request: Request) {
  try {
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