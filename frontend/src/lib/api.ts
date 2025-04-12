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

// --- NEW Frontend Persona Type ---
export interface Persona {
  id: string;
  name: string;
  color: string; // Stored Tailwind classes
  userId?: string; // Optional, depending if backend sends it
}

// Interview storage types
export interface Interview {
  id: string;
  created_at: string;
  title: string;
  problem_count: number;
  transcript_length: number;
  analysis_data: any;
  project_id: string | null;
  participants?: string | null;
  userId?: string | null;
  project?: {
    id: string;
    name: string;
  } | null;
  personas?: Persona[]; 
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
  data: Interview; 
}

// --- UPDATED Response Type for /api/personas ---
export interface PersonasResponse {
  status: string;
  message?: string;
  data: Persona[]; 
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
      credentials: 'include',
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
export async function analyzeTranscript(
  file: File, 
  userId?: string, 
  projectId?: string,
  interviewer?: string,
  interviewee?: string,
  interview_date?: string
): Promise<AnalysisResponse> {
  // Prepare FormData
  const formData = new FormData();
  formData.append('file', file);
  if (userId) {
      formData.append('userId', userId);
  }
  if (projectId) {
    formData.append('projectId', projectId);
  }
  if (interviewer) {
    formData.append('interviewer', interviewer);
  }
  if (interviewee) {
    formData.append('interviewee', interviewee);
  }
  if (interview_date) {
    formData.append('interview_date', interview_date);
  }

  console.log(`[lib/api] analyzeTranscript called with projectId: ${projectId}, interviewer: ${interviewer}, interviewee: ${interviewee}`);
  try {
    // Call the *internal* Next.js API route, not the gateway directly
    const response = await fetch(`/api/analyze-transcript`, { 
      method: 'POST',
      body: formData,
      // No explicit Authorization header needed here - the internal route handles it
      credentials: 'include' // Send session cookies to the internal route
    });

    console.log(`[lib/api] Response status from /api/analyze-transcript: ${response.status}`);

    if (!response.ok) {
      let errorDetail: string;
      const responseText = await response.text();
      try {
        const errorJson = JSON.parse(responseText);
        errorDetail = JSON.stringify(errorJson);
      } catch {
        errorDetail = responseText;
      }
      console.error(`[lib/api] Error analyzing transcript (${response.status}): ${errorDetail}`);
      throw new Error(`Failed to analyze transcript (${response.status}): ${errorDetail}`);
    }

    const data = await response.json();
    console.log("[lib/api] Successfully received analysis response.");
    return data;
  } catch (error) {
    console.error("[lib/api] Catch block error in analyzeTranscript:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to analyze transcript');
  }
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
  console.log("[lib/api] getInterviews called");
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });
    
    // The internal Next.js API route `/api/interviews` will handle authentication
    // We just need to call it.
    const apiUrl = `/api/interviews?${params}`;
    console.log(`[lib/api] Fetching from internal API route: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json' // Standard Accept header
      },
      credentials: 'include', // Send cookies to the internal API route
      cache: 'no-store' // Ensure fresh data
    });
    
    console.log(`[lib/api] Response status from ${apiUrl}: ${response.status}`);

    if (!response.ok) {
      let errorDetail: string;
      const responseText = await response.text();
      try {
        const errorJson = JSON.parse(responseText);
        errorDetail = JSON.stringify(errorJson);
      } catch {
        errorDetail = responseText;
      }
      console.error(`[lib/api] Error fetching interviews (${response.status}): ${errorDetail}`);
      throw new Error(`Failed to fetch interviews (${response.status}): ${errorDetail}`);
    }

    const data = await response.json();
    console.log("[lib/api] Successfully fetched and parsed interviews.");
    return data;
  } catch (error) {
    console.error("[lib/api] Catch block error in getInterviews:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch interviews');
  }
}

// Get a specific interview by ID
export async function getInterviewById(id: string): Promise<InterviewDetailResponse> {
  console.log("[lib/api] getInterviewById called for ID:", id);
  try {
    // The internal Next.js API route `/api/interviews/[id]` will handle authentication
    const apiUrl = `/api/interviews/${id}`;
    console.log(`[lib/api] Fetching from internal API route: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      credentials: 'include',
      cache: 'no-store',
    });
    
    console.log(`[lib/api] Response status from ${apiUrl}: ${response.status}`);

    if (!response.ok) {
      let errorDetail: string;
      const responseText = await response.text();
      try {
        const errorJson = JSON.parse(responseText);
        errorDetail = JSON.stringify(errorJson);
      } catch {
        errorDetail = responseText;
      }
      console.error(`[lib/api] Error fetching interview ${id} (${response.status}): ${errorDetail}`);
      throw new Error(`Failed to fetch interview (${response.status}): ${errorDetail}`);
    }

    const data = await response.json();
    console.log(`[lib/api] Successfully fetched and parsed interview ${id}.`);
    return data;
  } catch (error) {
    console.error(`[lib/api] Catch block error in getInterviewById for ${id}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch interview');
  }
}

// Define a type for the expected success response when creating a project
// This should match the `data` part of the response from the backend
export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  updatedAt?: string; // Add updatedAt (optional if needed)
  owner?: { // Add owner object
    name: string | null; // Include owner's name
  };
  _count?: { // Add _count object
    interviews: number; // Include interview count
  };
  // Add other fields like created_at if they are returned
}

// Add this new interface for the GetProjects response
export interface ProjectsResponse {
  status: string;
  message?: string;
  data: {
    projects: Project[];
    total: number;
  };
}

export interface CreateProjectResponse {
  status: string;
  message?: string;
  data?: Project; // The created project data
}

// --- UPDATED API Function --- 
// Function to get all unique personas for the user
export async function getAllPersonas(): Promise<PersonasResponse> {
  const url = `/api/personas`; // Use internal API route
  
  console.log(`[lib/api] getAllPersonas calling internal route: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', 
    });

    if (!response.ok) {
      let errorDetail = 'Failed to fetch personas';
      try {
        const errorJson = await response.json();
        errorDetail = errorJson.message || errorJson.detail || JSON.stringify(errorJson);
      } catch { 
         errorDetail = response.statusText;
      }
      console.error(`[lib/api] Error fetching personas (${response.status}): ${errorDetail}`);
      return { status: 'error', message: `API Error (${response.status}): ${errorDetail}`, data: [] };
    }

    const data = await response.json();
    console.log(`[lib/api] Successfully received personas:`, data);
    // Type assertion might be needed if backend response isn't strictly typed
    return data as PersonasResponse; 

  } catch (error) {
    console.error('[lib/api] Catch block error in getAllPersonas:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return { status: 'error', message, data: [] };
  }
}

// --- NEW API Function ---
// Function to create a new persona
export async function createPersona(name: string, color: string): Promise<{ status: string, message?: string, data?: Persona }> {
  // Call a dedicated internal route for creation
  const url = `/api/create-persona`; 
  console.log(`[lib/api] createPersona calling internal route: POST ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Body needs userId (from session), name, and color
      body: JSON.stringify({ name, color }), // Include color
      credentials: 'include', 
    });

    const result = await response.json();

    if (!response.ok || result.status !== 'success') {
      const errorMessage = result.message || 'Failed to create persona';
      console.error(`[lib/api] Error creating persona (${response.status}): ${JSON.stringify(result)}`);
      throw new Error(errorMessage);
    }

    console.log(`[lib/api] Successfully created persona:`, result.data);
    return result;

  } catch (error) {
    console.error('[lib/api] Catch block error creating persona:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    // Return structure consistent with other functions on error
    return { status: 'error', message }; 
  }
}

// --- MODIFIED API Function --- 
// Update interview title, project association, OR persona links
export async function updateInterview(
  id: string, 
  data: { 
    title?: string; 
    project_id?: string | null; 
    personaIds?: string[]; 
  }
): Promise<{ status: string, message?: string, data?: Interview }> {
  const url = `/api/interviews/${id}`; // Use internal API route
  
  console.log(`[lib/api] updateInterview calling internal route: ${url} with data:`, data);

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      credentials: 'include', 
    });

    if (!response.ok) {
      let errorDetail = 'Failed to update interview';
      try {
        const errorJson = await response.json();
        errorDetail = errorJson.message || errorJson.detail || JSON.stringify(errorJson);
      } catch {
        errorDetail = response.statusText;
      }
      console.error(`[lib/api] Error updating interview ${id} (${response.status}): ${errorDetail}`);
      return { status: 'error', message: `API Error (${response.status}): ${errorDetail}` };
    }

    const result = await response.json();
    console.log(`[lib/api] Successfully updated interview ${id}:`, result);
    return result; 

  } catch (error) {
    console.error(`[lib/api] Catch block error updating interview ${id}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return { status: 'error', message };
  }
}

export async function createProject(name: string, description?: string): Promise<CreateProjectResponse> {
  console.log(`[lib/api] createProject called with name: "${name}"`);
  try {
    const apiUrl = `/api/projects`; // Internal Next.js API route
    console.log(`[lib/api] Sending POST request to internal API route: ${apiUrl}`);

    const payload = {
      name,
      description: description || undefined, // Send undefined if description is empty/null
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      credentials: 'include', // Send cookies to the internal API route
    });

    console.log(`[lib/api] Response status from ${apiUrl}: ${response.status}`);

    const responseData: CreateProjectResponse = await response.json();

    if (!response.ok || responseData.status !== 'success') {
      // Use message from responseData if available
      const errorMessage = responseData.message || 'Unknown error creating project';
      console.error(`[lib/api] Error creating project (${response.status}): ${JSON.stringify(responseData)}`);
      throw new Error(`Failed to create project (${response.status}): ${errorMessage}`);
    }

    console.log(`[lib/api] Successfully created project:`, responseData.data);
    return responseData;

  } catch (error) {
    console.error(`[lib/api] Catch block error in createProject:`, error);
    if (error instanceof Error) {
      // Re-throw the specific error message
      throw error;
    }
    // Throw a generic error if it wasn't an Error instance
    throw new Error('Failed to create project due to an unexpected error');
  }
}

// Get projects from the API
export async function getProjects(limit: number = 50, offset: number = 0): Promise<ProjectsResponse> {
  console.log("[lib/api] getProjects called");
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });
    
    // Assume internal Next.js API route `/api/projects` handles authentication
    const apiUrl = `/api/projects?${params}`;
    console.log(`[lib/api] Fetching from internal API route: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      credentials: 'include', 
      cache: 'no-store' // Ensure fresh data for project lists usually
    });
    
    console.log(`[lib/api] Response status from ${apiUrl}: ${response.status}`);

    if (!response.ok) {
      let errorDetail: string;
      const responseText = await response.text();
      try {
        const errorJson = JSON.parse(responseText);
        errorDetail = JSON.stringify(errorJson);
      } catch {
        errorDetail = responseText;
      }
      console.error(`[lib/api] Error fetching projects (${response.status}): ${errorDetail}`);
      throw new Error(`Failed to fetch projects (${response.status}): ${errorDetail}`);
    }

    const data = await response.json();
    console.log("[lib/api] Successfully fetched and parsed projects.");
    return data;
  } catch (error) {
    console.error("[lib/api] Catch block error in getProjects:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch projects');
  }
}

/**
 * Represents the structure of persona suggestions returned by the API.
 */
export interface PersonaSuggestionResponse {
  existing_persona_ids: string[];
  suggested_new_personas: string[]; // Currently just names, could be objects later
}

/**
 * Calls the backend API to get AI-suggested personas for an interview.
 * 
 * @param interviewId The ID of the interview to get suggestions for.
 * @returns A promise resolving to the persona suggestions.
 * @throws If the API call fails or returns an error status.
 */
export async function suggestPersonas(interviewId: string): Promise<PersonaSuggestionResponse> {
  if (!interviewId) {
    throw new Error("Interview ID is required to suggest personas.");
  }

  console.log(`[API] Suggesting personas for interview: ${interviewId}`);
  
  // TODO: Add proper authentication headers if required by the backend
  // const headers = getAuthHeaders(); // Example

  const response = await fetch(`/api/personas/${interviewId}/suggest_personas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // ...headers // Include auth headers if needed
      // Placeholder for user ID if needed via headers and not context/token
      // 'X-User-ID': 'get-current-user-id-somehow' 
    },
    // No body is needed as per the current backend endpoint definition
  });

  // Handle non-JSON responses gracefully
  let responseBody;
  try {
    responseBody = await response.json();
  } catch (error: any) {
    console.error(`[API] Error parsing JSON response for interview ${interviewId}:`, error);
    throw new Error(`Failed to parse response from server: ${error.message}`);
  }

  if (!response.ok || responseBody.status !== 'success') {
    const errorMessage = responseBody?.message || `API Error: ${response.status} ${response.statusText}`;
    console.error(`[API] Failed to suggest personas for interview ${interviewId}:`, errorMessage, responseBody);
    throw new Error(errorMessage);
  }

  console.log(`[API] Successfully received persona suggestions for interview ${interviewId}:`, responseBody.data);
  
  // Validate the structure of the data slightly
  if (!responseBody.data || !Array.isArray(responseBody.data.existing_persona_ids) || !Array.isArray(responseBody.data.suggested_new_personas)) {
     console.error("[API] Invalid suggestion data structure received:", responseBody.data);
     throw new Error("Received invalid data structure for persona suggestions.");
  }
  
  return responseBody.data as PersonaSuggestionResponse;
}

export async function deletePersona(personaId: string): Promise<{ status: string, message?: string, data?: Persona }> {
  console.log(`[lib/api] deletePersona called for ID: ${personaId}`);
  try {
    // Ensure this matches the internal API route you set up in the frontend's /api directory
    const apiUrl = `/api/personas/${personaId}`; 
    console.log(`[lib/api] Deleting via internal API route: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json'
      },
      credentials: 'include', // Important for sending session cookies
    });

    console.log(`[lib/api] Response status from DELETE ${apiUrl}: ${response.status}`);
    const responseText = await response.text(); // Read text regardless of status

    if (!response.ok) {
      let errorDetail = responseText;
      try {
        // Attempt to parse JSON error for more detail
        const errorJson = JSON.parse(responseText);
        if(errorJson.message) errorDetail = errorJson.message;
      } catch {} // Ignore if parsing fails
      console.error(`[lib/api] Error deleting persona ${personaId} (${response.status}): ${errorDetail}`);
      return { status: 'error', message: errorDetail || `Failed to delete persona (${response.status})` };
    }

    // Try to parse success response (might contain the deleted object)
    let responseData: any = {};
    try {
        responseData = JSON.parse(responseText);
    } catch {} // Ignore if parsing fails

    console.log(`[lib/api] Successfully deleted persona ${personaId}.`);
    // Return structure might vary based on your actual API response
    return { status: 'success', message: responseData.message || 'Persona deleted successfully', data: responseData.data };

  } catch (error) {
    console.error(`[lib/api] Catch block error in deletePersona for ${personaId}:`, error);
    const message = error instanceof Error ? error.message : 'Failed to delete persona due to a network or unexpected error.';
    return { status: 'error', message: message };
  }
} 