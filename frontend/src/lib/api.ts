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

// --- NEW Types for Problem Areas and Excerpts ---
export interface Excerpt {
  id: string;
  problem_area_id: string;
  quote: string;
  categories: string[];
  insight: string;
  chunk_number: number;
}

export interface ProblemArea {
  id: string;
  interview_id: string;
  title: string;
  description: string;
  is_confirmed: boolean;
  priority?: string | null; // Added optional priority
  created_at: string; // Represent dates as strings
  updated_at: string;
  excerpts: Excerpt[];
}

// Interview storage types (UPDATED)
export interface Interview {
  id: string;
  created_at: string;
  title: string;
  problem_count: number;
  transcript_length: number;
  analysis_data: any; // Re-add temporarily for transcript/synthesis
  project_id: string | null;
  participants?: string | null;
  userId?: string | null;
  project?: {
    id: string;
    name: string;
  } | null;
  personas?: Persona[];
  problemAreas?: ProblemArea[]; // Added typed relation
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

// --- NEW Project-Specific Response Types ---
export interface ProjectDetailResponse {
  status: string;
  message?: string;
  data?: Project;
}

// Matches the type defined in the page component
interface ProblemAreaWithInterviewContext extends ProblemArea {
  interview: {
    id: string;
    title: string;
    personas: Persona[];
  }
}

export interface ProjectProblemAreasResponse {
  status: string;
  message?: string;
  data?: {
    problemAreas: ProblemAreaWithInterviewContext[];
  };
}

export interface ProjectInterviewsResponse {
  status: string;
  message?: string;
  data?: {
    interviews: Interview[]; // Use existing Interview type, assuming fields match
  };
}

// --- END NEW Project-Specific Response Types ---

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
  _count?: { 
    interviews: number; 
  };
  // Add field to hold the latest interview data for sorting
  interviews?: Array<{ created_at: string }>; 
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
    // Ensure the returned data conforms to the Interview type
    return result as { status: string, message?: string, data?: Interview }; 

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
    return { status: 'error', message };
  }
}

// --- NEW API Function ---
// Function to delete an interview
export async function deleteInterview(id: string): Promise<{ status: string, message?: string }> {
  if (!id) {
    throw new Error("Interview ID is required to delete.");
  }
  const url = `/api/interviews/${id}`; // Use internal API route
  
  console.log(`[lib/api] deleteInterview calling internal route: DELETE ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json', 
      },
      credentials: 'include', 
    });

    // Check for successful deletion (200 OK or 204 No Content)
    if (response.ok) {
      // Try to parse potential JSON response, but don't fail if it's empty (204)
      let message = 'Interview deleted successfully';
      try {
        const result = await response.json();
        message = result.message || message;
      } catch {
        // Ignore parsing error for 204 No Content
      }
      console.log(`[lib/api] Successfully deleted interview ${id}.`);
      return { status: 'success', message };
    } else {
      // Handle errors
      let errorDetail = 'Failed to delete interview';
      try {
        const errorJson = await response.json();
        errorDetail = errorJson.message || errorJson.detail || JSON.stringify(errorJson);
      } catch { 
         errorDetail = response.statusText;
      }
      console.error(`[lib/api] Error deleting interview ${id} (${response.status}): ${errorDetail}`);
      return { status: 'error', message: `API Error (${response.status}): ${errorDetail}` };
    }

  } catch (error) {
    console.error(`[lib/api] Catch block error deleting interview ${id}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return { status: 'error', message };
  }
}

// --- NEW API Functions for Problem Areas ---

export async function updateProblemArea(
  problemAreaId: string,
  data: { title?: string; description?: string }
): Promise<{ status: string, message?: string, data?: ProblemArea }> {
  const url = `/api/problem-areas/${problemAreaId}`; // Internal Next.js route
  console.log(`[lib/api] updateProblemArea calling internal route: PUT ${url}`);

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });

    const result = await response.json();
    if (!response.ok || result.status !== 'success') {
      const errorMsg = result.message || 'Failed to update problem area';
      console.error(`[lib/api] Error updating problem area ${problemAreaId} (${response.status}):`, result);
      throw new Error(errorMsg);
    }
    console.log(`[lib/api] Successfully updated problem area ${problemAreaId}`);
    return result as { status: string, message?: string, data?: ProblemArea }; // Return updated data
  } catch (error) {
    console.error(`[lib/api] Catch block error updating problem area ${problemAreaId}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return { status: 'error', message };
  }
}

export async function confirmProblemArea(
  problemAreaId: string,
  isConfirmed: boolean,
  priority?: string | null // Added optional priority parameter
): Promise<{ status: string, message?: string, data?: ProblemArea }> {
  const url = `/api/problem-areas/${problemAreaId}/confirm`; // Internal Next.js route
  console.log(`[lib/api] confirmProblemArea calling internal route: PATCH ${url}`);

  // Prepare body, include priority if provided
  const body: { isConfirmed: boolean; priority?: string | null } = { isConfirmed };
  if (priority !== undefined) { // Send priority even if null (to clear it)
      body.priority = priority;
  }

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), // Send body with isConfirmed and optional priority
      credentials: 'include',
    });

    const result = await response.json();
    if (!response.ok || result.status !== 'success') {
      const errorMsg = result.message || 'Failed to update problem area confirmation';
      console.error(`[lib/api] Error confirming problem area ${problemAreaId} (${response.status}):`, result);
      throw new Error(errorMsg);
    }
    console.log(`[lib/api] Successfully updated confirmation for problem area ${problemAreaId}`);
    return result as { status: string, message?: string, data?: ProblemArea }; // Return updated data
  } catch (error) {
    console.error(`[lib/api] Catch block error confirming problem area ${problemAreaId}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return { status: 'error', message };
  }
}

export async function deleteProblemArea(
  problemAreaId: string
): Promise<{ status: string, message?: string, data?: ProblemArea }> {
  const url = `/api/problem-areas/${problemAreaId}`; // Internal Next.js route
  console.log(`[lib/api] deleteProblemArea calling internal route: DELETE ${url}`);

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
    });

    const result = await response.json(); // Assume API returns JSON even for DELETE success/error
    if (!response.ok || result.status !== 'success') {
      const errorMsg = result.message || 'Failed to delete problem area';
      console.error(`[lib/api] Error deleting problem area ${problemAreaId} (${response.status}):`, result);
      throw new Error(errorMsg);
    }
    console.log(`[lib/api] Successfully deleted problem area ${problemAreaId}`);
    // Return the data which might include the deleted object, or adjust as needed
    return result as { status: string, message?: string, data?: ProblemArea }; 
  } catch (error) {
    console.error(`[lib/api] Catch block error deleting problem area ${problemAreaId}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return { status: 'error', message };
  }
}

// --- NEW Project-Specific API Functions ---

// Get a specific project by ID
export async function getProjectById(projectId: string): Promise<ProjectDetailResponse> {
  console.log(`[lib/api] getProjectById called for ID: ${projectId}`);
  if (!projectId) {
    console.error("[lib/api] getProjectById: projectId is missing.");
    return { status: 'error', message: 'Project ID is required.' };
  }
  try {
    const apiUrl = `/api/projects/${projectId}`; // Assuming internal route exists
    console.log(`[lib/api] Fetching from internal API route: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
    });

    console.log(`[lib/api] Response status from ${apiUrl}: ${response.status}`);
    const responseData = await response.json(); // Parse JSON regardless of status

    if (!response.ok) {
      const errorDetail = JSON.stringify(responseData);
      console.error(`[lib/api] Error fetching project ${projectId} (${response.status}): ${errorDetail}`);
      // Return the error structure from the API if possible
      return { status: 'error', message: responseData.message || responseData.detail || `Failed to fetch project (${response.status})`, data: responseData.data };
    }

    console.log(`[lib/api] Successfully fetched and parsed project ${projectId}.`);
    return responseData; // Assumes backend returns { status: 'success', data: Project }

  } catch (error) {
    console.error(`[lib/api] Catch block error in getProjectById for ${projectId}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return { status: 'error', message };
  }
}

// Get confirmed problem areas for a specific project
export async function getProjectProblemAreas(projectId: string): Promise<ProjectProblemAreasResponse> {
  console.log(`[lib/api] getProjectProblemAreas called for project ID: ${projectId}`);
  if (!projectId) {
    console.error("[lib/api] getProjectProblemAreas: projectId is missing.");
    return { status: 'error', message: 'Project ID is required.' };
  }
  try {
    // Internal Next.js API route
    const apiUrl = `/api/projects/${projectId}/problem-areas`;
    console.log(`[lib/api] Fetching from internal API route: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
    });

    console.log(`[lib/api] Response status from ${apiUrl}: ${response.status}`);
    const responseData = await response.json(); 

    if (!response.ok) {
      const errorDetail = JSON.stringify(responseData);
      console.error(`[lib/api] Error fetching problem areas for project ${projectId} (${response.status}): ${errorDetail}`);
      return { status: 'error', message: responseData.message || responseData.detail || `Failed to fetch problem areas (${response.status})`, data: responseData.data };
    }

    console.log(`[lib/api] Successfully fetched problem areas for project ${projectId}.`);
    // Assuming backend returns { status: 'success', data: { problemAreas: [...] } }
    return responseData; 

  } catch (error) {
    console.error(`[lib/api] Catch block error in getProjectProblemAreas for ${projectId}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return { status: 'error', message };
  }
}

// Get interviews for a specific project
export async function getProjectInterviews(projectId: string): Promise<ProjectInterviewsResponse> {
  console.log(`[lib/api] getProjectInterviews called for project ID: ${projectId}`);
  if (!projectId) {
    console.error("[lib/api] getProjectInterviews: projectId is missing.");
    return { status: 'error', message: 'Project ID is required.' };
  }
  try {
    const apiUrl = `/api/projects/${projectId}/interviews`; // Internal Next.js API route
    console.log(`[lib/api] Fetching from internal API route: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
    });

    console.log(`[lib/api] Response status from ${apiUrl}: ${response.status}`);
    const responseData = await response.json();

    if (!response.ok) {
      const errorDetail = JSON.stringify(responseData);
      console.error(`[lib/api] Error fetching interviews for project ${projectId} (${response.status}): ${errorDetail}`);
      return { status: 'error', message: responseData.message || responseData.detail || `Failed to fetch interviews (${response.status})`, data: responseData.data };
    }

    console.log(`[lib/api] Successfully fetched interviews for project ${projectId}.`);
    // Assuming backend returns { status: 'success', data: { interviews: [...] } }
    return responseData;

  } catch (error) {
    console.error(`[lib/api] Catch block error in getProjectInterviews for ${projectId}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return { status: 'error', message };
  }
}

// --- END NEW Project-Specific API Functions ---

// --- NEW Project Update and Delete Functions ---

/**
 * Updates a project's name and/or description.
 * @param projectId The ID of the project to update.
 * @param data An object containing the fields to update (name, description).
 * @returns A promise resolving to the API response.
 */
export async function updateProject(
  projectId: string,
  data: { name?: string; description?: string | null }
): Promise<{ status: string; message?: string; data?: Project }> {
  if (!projectId) {
    throw new Error("Project ID is required to update.");
  }
  const url = `/api/projects/${projectId}`; // Internal Next.js route
  console.log(`[lib/api] updateProject calling internal route: PUT ${url}`);

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include', // Send session cookies
    });

    const result = await response.json();

    if (!response.ok || result.status !== 'success') {
      const errorMsg = result.message || result.detail || 'Failed to update project';
      console.error(`[lib/api] Error updating project ${projectId} (${response.status}):`, result);
      return { status: 'error', message: `API Error (${response.status}): ${errorMsg}` };
    }

    console.log(`[lib/api] Successfully updated project ${projectId}`);
    return result as { status: string; message?: string; data?: Project };

  } catch (error) {
    console.error(`[lib/api] Catch block error updating project ${projectId}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown network or unexpected error occurred';
    return { status: 'error', message };
  }
}

/**
 * Deletes a project.
 * @param projectId The ID of the project to delete.
 * @param force Optional: If true, deletes project and associated interviews/problem areas.
 * @returns A promise resolving to the API response (usually just status/message).
 */
export async function deleteProject(
  projectId: string,
  force: boolean = false // Add force parameter
): Promise<{ status: string; message?: string }> {
  if (!projectId) {
    throw new Error("Project ID is required to delete.");
  }
  let url = `/api/projects/${projectId}`; // Internal Next.js route
  if (force) {
    url += '?force=true'; // Append force parameter if true
  }
  console.log(`[lib/api] deleteProject calling internal route: DELETE ${url}`);

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' },
      credentials: 'include', // Send session cookies
    });

    // Handle specific known status codes FIRST
    if (response.status === 204) {
        console.log(`[lib/api] Successfully deleted project ${projectId} (204 No Content).`);
        return { status: 'success', message: 'Project deleted successfully' };
    }
    if (response.status === 409) {
        // Assume 409 means "contains interviews" in this context
        console.log(`[lib/api] Received 409 Conflict for project ${projectId}, likely contains interviews.`);
        return { status: 'error', message: 'Cannot delete project: It still contains interviews. Please remove or reassign interviews first.' };
    }
    
    // For other status codes (including potential success with body like 200 OK), try to parse JSON
    let result: any = {}; // Initialize result
    let errorMsg: string = 'Failed to delete project'; // Default error message
    try {
        result = await response.json(); 
        // Try to get a more specific message from the parsed result
        errorMsg = result.message || result.detail || errorMsg;
    } catch (parseError) {
        console.warn(`[lib/api] Failed to parse JSON response for DELETE ${projectId} (status: ${response.status}).`);
        // Use status text if JSON parsing fails
        errorMsg = response.statusText || errorMsg;
    }

    // Check if the operation was successful based on status code OR parsed result
    if (!response.ok) {
       // Log the error only if it wasn't the handled 409
       console.error(`[lib/api] Error deleting project ${projectId} (${response.status}):`, result); // Log the parsed result (might be {}) or raw error info
       return { status: 'error', message: `API Error (${response.status}): ${errorMsg}` };
    }

    // If response.ok is true (e.g., 200 OK), assume success
    console.log(`[lib/api] Successfully deleted project ${projectId} (Status: ${response.status}).`);
    return { status: 'success', message: result.message || 'Project deleted successfully' }; // Use message from result if available

  } catch (error) {
    console.error(`[lib/api] Catch block error deleting project ${projectId}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown network or unexpected error occurred';
    return { status: 'error', message };
  }
}

// Define a type for the expected success response when creating a project
// ... existing code ... 