// Create new file for API functions
export type Chunk = {
  chunk_number: number;
  speaker: string;
  text: string;
};

export interface AnalysisResponse {
  data: {
    synthesis: string;
    metadata: {
      problem_areas_count: number;
      excerpts_total_count: number;
    };
    transcript: {
      chunk_number: number;
      speaker: string;
      text: string;
    }[];
    problem_areas: {
      problem_id: string;
      title: string;
      description: string;
      category: string;
      excerpts: {
        chunk_number: number;
        text: string;
        quote: string;
        insight: string;
        categories: string[];
        analysis: string;
      }[];
    }[];
  };
}

export async function analyzeTranscript(file: File): Promise<AnalysisResponse> {
  try {
    // Create form data to send the file
    const formData = new FormData();
    formData.append('file', file);

    // Make the API call to your backend
    const response = await fetch('/api/analyze-transcript', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    throw error;
  }
} 