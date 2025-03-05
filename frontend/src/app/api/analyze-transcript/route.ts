import { NextResponse } from 'next/server';

// Update the FastAPI endpoint URL to match your backend route
const FASTAPI_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

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

    // Forward the VTT file to FastAPI
    // 1) Construct new FormData with the received file
    const forwardForm = new FormData();
    forwardForm.append('file', file);

    // 2) Perform a POST request to your Python backend "/api/interview/synthesis" endpoint
    const backendResponse = await fetch(`${FASTAPI_URL}/api/interview/synthesis`, {
      method: 'POST',
      body: forwardForm,
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Error from Python backend:', errorText);
      return NextResponse.json(
        { error: 'Failed to process transcript', details: errorText },
        { status: backendResponse.status }
      );
    }

    // 3) Return the JSON from FastAPI directly to your Next.js client
    const data = await backendResponse.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error forwarding to Python backend:', error);
    return NextResponse.json(
      { error: 'Failed to process transcript' },
      { status: 500 }
    );
  }
} 