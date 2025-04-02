// Create new file for API functions
export type Chunk = {
  chunk_number: number;
  speaker: string;
  text: string;
};

// API Response Types
export interface AnalysisResponse {
  status: string;
  message?: string;
  data: {
    problem_areas: Array<{
      problem_id: string;
      title: string;
      description: string;
      excerpts: Array<{
        quote?: string;
        text?: string;
        categories: string[];
        insight?: string;
        insight_summary?: string;
        transcript_reference?: string;
        chunk_number?: number;
      }>;
    }>;
    synthesis: string | {
      background: string;
      problem_areas: string[];
      next_steps: string[];
    };
    metadata: {
      transcript_length: number;
      problem_areas_count: number;
      excerpts_count: number;
      excerpts_total_count?: number;
    };
    transcript: Chunk[];
    storage?: {
      id: string;
      created_at: string;
    };
  };
}

export interface SummaryResponse {
  status: string;
  data: {
    summary: string;
    metadata: {
      model_used: string;
      transcript_length: number;
    };
  };
}

export interface KeywordAnalysisResponse {
  status: string;
  data: {
    analysis: {
      pain_points: string[];
      demands: string[];
      themes: string[];
    };
    metadata: {
      model_used: string;
      transcript_length: number;
    };
  };
}

export interface PreprocessResponse {
  status: string;
  data: {
    chunks: Chunk[];
    metadata: {
      transcript_length: number;
    };
  };
}

// Interview storage types
export interface Interview {
  id: string;
  created_at: string;
  title: string;
  problem_count: number;
  transcript_length: number;
  analysis_data: any;
  project_id?: string;
  interviewer?: string;
  interview_date?: string;
}

export interface InterviewsResponse {
  status: string;
  message: string;
  data: {
    interviews: Interview[];
    total: number;
  };
}

export interface InterviewDetailResponse {
  status: string;
  message: string;
  data: Interview & {
    analysis_data: any;
  };
}

// API Configuration
export const API_CONFIG = {
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  DATABASE_URL: process.env.NEXT_PUBLIC_DATABASE_URL || 'http://localhost:5001',
  ENDPOINTS: {
    INTERVIEW_ANALYSIS: {
      ANALYZE: '/api/interview_analysis/analyze'
    },
    SPRINT1_DEPRECATED: {
      PREPROCESS: '/api/sprint1_deprecated/preprocess',
      SUMMARIZE: '/api/sprint1_deprecated/summarize',
      KEYWORDS: '/api/sprint1_deprecated/keywords'
    }
  }
};

// Generic API request function to reduce code duplication
async function apiRequest<T>(
  endpoint: string, 
  file: File, 
  errorMessage: string = 'API request failed',
  additionalData?: Record<string, string>
): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  
  // Add any additional data to the form
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  try {
    const response = await fetch(`${API_CONFIG.API_URL}${endpoint}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorDetail: string;
      try {
        // Try to parse error as JSON first
        const errorJson = await response.json();
        errorDetail = JSON.stringify(errorJson);
      } catch {
        // If not JSON, get as text
        errorDetail = await response.text();
      }
      
      throw new Error(`${errorMessage} (${response.status}): ${errorDetail}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    // Handle non-Error throws
    throw new Error(errorMessage);
  }
}

// API Client Functions
export async function analyzeTranscript(file: File, userId?: string): Promise<AnalysisResponse> {
  const additionalData = userId ? { userId } : undefined;
  
  return apiRequest<AnalysisResponse>(
    API_CONFIG.ENDPOINTS.INTERVIEW_ANALYSIS.ANALYZE,
    file,
    'Failed to analyze transcript',
    additionalData
  );
}

export async function preprocessTranscript(file: File): Promise<PreprocessResponse> {
  return apiRequest<PreprocessResponse>(
    API_CONFIG.ENDPOINTS.SPRINT1_DEPRECATED.PREPROCESS,
    file,
    'Failed to preprocess transcript'
  );
}

export async function summarizeTranscript(file: File): Promise<SummaryResponse> {
  return apiRequest<SummaryResponse>(
    API_CONFIG.ENDPOINTS.SPRINT1_DEPRECATED.SUMMARIZE,
    file,
    'Failed to summarize transcript'
  );
}

export async function extractKeywords(file: File): Promise<KeywordAnalysisResponse> {
  return apiRequest<KeywordAnalysisResponse>(
    API_CONFIG.ENDPOINTS.SPRINT1_DEPRECATED.KEYWORDS,
    file,
    'Failed to extract keywords'
  );
}

// Get interviews from the API
export async function getInterviews(limit: number = 10, offset: number = 0): Promise<InterviewsResponse> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });
    
    // Use local API endpoint that directly connects to the Database Service
    // Bypassing the Interview Analysis service for more efficient retrieval
    const response = await fetch(`/api/interviews?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      let errorDetail: string;
      try {
        // Try to parse error as JSON first
        const errorJson = await response.json();
        errorDetail = JSON.stringify(errorJson);
      } catch {
        // If not JSON, get as text
        errorDetail = await response.text();
      }
      
      throw new Error(`Failed to fetch interviews (${response.status}): ${errorDetail}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    // Handle non-Error throws
    throw new Error('Failed to fetch interviews');
  }
}

// Get a specific interview by ID
export async function getInterviewById(id: string): Promise<InterviewDetailResponse> {
  try {
    // Use local API endpoint that directly connects to the Database Service
    // Bypassing the Interview Analysis service for more efficient retrieval
    const response = await fetch(`/api/interviews/${id}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      let errorDetail: string;
      try {
        // Try to parse error as JSON first
        const errorJson = await response.json();
        errorDetail = JSON.stringify(errorJson);
      } catch {
        // If not JSON, get as text
        errorDetail = await response.text();
      }
      
      throw new Error(`Failed to fetch interview (${response.status}): ${errorDetail}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    // Handle non-Error throws
    throw new Error('Failed to fetch interview');
  }
} 