// src/api/server.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import { PrismaClient, Prisma, Interview, ProblemArea } from '@prisma/client'; // Import necessary Prisma types

// Correctly import Repository Classes (assuming PascalCase export)
import { InterviewRepository } from '../repositories/interviewRepository';
import { ProjectRepository } from '../repositories/projectRepository';
import { PersonaRepository } from '../repositories/personaRepository';
// Assuming ProblemArea actions might use InterviewRepository or direct prisma client for now
// import { ProblemAreaRepository } from '../repositories/problemAreaRepository'; // Add if it exists and is needed

// Import the function to get the client instance
import { getPrismaClient } from '../client';

// Initialize Express app
const app = express();

// Instantiate repositories
const interviewRepository = new InterviewRepository();
const projectRepository = new ProjectRepository();
const personaRepository = new PersonaRepository();
// const problemAreaRepository = new ProblemAreaRepository(); // Instantiate if used

// Get Prisma client instance
const prisma = getPrismaClient();

// Configure CORS based on environment
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

// Define default origins by environment
const defaultOrigins = {
  development: [
    'http://localhost:3000',         // Frontend (local)
    'http://localhost:8000',         // API Gateway (local)
    'http://frontend:3000',          // Frontend (Docker)
    'http://api_gateway:8000'        // API Gateway (Docker)
  ],
  production: [
    'https://navi-cfci.vercel.app',  // Vercel frontend
    'https://api-gateway-navi-cfci-project-uc.a.run.app'  // Cloud Run API Gateway
  ]
};

// Use environment variable if available, otherwise use environment-specific defaults
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : isProduction 
    ? defaultOrigins.production
    : [...defaultOrigins.development, ...defaultOrigins.production]; // Development includes all for testing

// Log only in development or when debug is enabled
if (isDevelopment || process.env.DEBUG) {
  console.log(`[${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}] CORS allowed origins:`, corsOrigins);
}

// CORS configuration
app.use(cors({
  origin: function(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (corsOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Added PATCH
  credentials: true
}));

// Increase the JSON body limit 
app.use(json({ limit: '10mb' }));

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Database API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// -------------------------------\n// Problem Area Endpoints (NEW)\n// -------------------------------

// Helper function for authorization check
async function checkProblemAreaOwnership(problemAreaId: string, requestingUserId: string): Promise<boolean> {
  const problemArea = await prisma.problemArea.findUnique({
    where: { id: problemAreaId },
    select: { interview: { select: { userId: true } } } // Select only needed field
  });
  // Check if problem area exists and has an associated interview with a userId
  if (!problemArea?.interview?.userId) {
    return false;
  }
  return problemArea.interview.userId === requestingUserId;
}

// Update a Problem Area
app.put('/problem_areas/:id', async (req: Request, res: Response) => {
  try {
    const problemAreaId = req.params.id;
    const { title, description } = req.body;
    const userId = req.query.userId as string; // Assume userId passed as query param for auth

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized: Missing user ID.' });
    }
    // Use explicit checks for undefined, as empty strings might be valid input intent
    if (title === undefined && description === undefined) {
      return res.status(400).json({ status: 'error', message: 'No fields provided for update (title, description).' });
    }

    // Authorization Check
    const isOwner = await checkProblemAreaOwnership(problemAreaId, userId);
    if (!isOwner) {
       // Check if the resource exists before returning 403
       const exists = await prisma.problemArea.findUnique({ where: { id: problemAreaId }, select: { id: true } });
       if (!exists) {
           return res.status(404).json({ status: 'error', message: 'Problem area not found.' });
       }
       return res.status(403).json({ status: 'error', message: 'Forbidden: Not authorized to update this problem area.' });
    }

    const dataToUpdate: Prisma.ProblemAreaUpdateInput = {};
    if (title !== undefined) dataToUpdate.title = title;
    if (description !== undefined) dataToUpdate.description = description;

    const updatedProblemArea = await interviewRepository.updateProblemArea(problemAreaId, dataToUpdate);

    res.json({ status: 'success', message: 'Problem area updated successfully', data: updatedProblemArea });

  } catch (error: any) {
    console.error(`[PUT /problem_areas/:id] Error updating problem area ${req.params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      // This case should technically be caught by the isOwner check, but handle defensively
      return res.status(404).json({ status: 'error', message: 'Problem area not found.' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to update problem area', error: isDevelopment ? error.message : undefined });
  }
});

// Confirm/Unconfirm a Problem Area
app.patch('/problem_areas/:id/confirm', async (req: Request, res: Response) => {
  try {
    const problemAreaId = req.params.id;
    // Extract isConfirmed and optional priority from body
    const { isConfirmed, priority } = req.body;
    const userId = req.query.userId as string; // Assume userId passed as query param for auth

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized: Missing user ID.' });
    }
    if (typeof isConfirmed !== 'boolean') {
      return res.status(400).json({ status: 'error', message: 'Invalid request body: isConfirmed (boolean) is required.' });
    }
    // Validate priority if present (optional)
    if (priority !== undefined && priority !== null && typeof priority !== 'string') {
        return res.status(400).json({ status: 'error', message: 'Invalid priority format: Must be a string or null.' });
    }
    // You could add specific validation: if (priority && !['L', 'M', 'S'].includes(priority)) ...

    // Authorization Check
    const isOwner = await checkProblemAreaOwnership(problemAreaId, userId);
    if (!isOwner) {
       const exists = await prisma.problemArea.findUnique({ where: { id: problemAreaId }, select: { id: true } });
       if (!exists) {
           return res.status(404).json({ status: 'error', message: 'Problem area not found.' });
       }
       return res.status(403).json({ status: 'error', message: 'Forbidden: Not authorized to update this problem area.' });
    }

    // Call repository method with priority
    const updatedProblemArea = await interviewRepository.confirmProblemArea(problemAreaId, isConfirmed, priority);

    res.json({ status: 'success', message: `Problem area ${isConfirmed ? 'confirmed' : 'unconfirmed'} successfully`, data: updatedProblemArea });

  } catch (error: any) {
    console.error(`[PATCH /problem_areas/:id/confirm] Error updating problem area ${req.params.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ status: 'error', message: 'Problem area not found.' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to update problem area confirmation', error: isDevelopment ? error.message : undefined });
  }
});

// Delete a Problem Area
app.delete('/problem_areas/:id', async (req: Request, res: Response) => {
  try {
    const problemAreaId = req.params.id;
    const userId = req.query.userId as string; // Assume userId passed as query param for auth

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized: Missing user ID.' });
    }

    // Authorization Check - Check existence first
    const isOwner = await checkProblemAreaOwnership(problemAreaId, userId);
     if (!isOwner) {
       const exists = await prisma.problemArea.findUnique({ where: { id: problemAreaId }, select: { id: true } });
       if (!exists) {
           return res.status(404).json({ status: 'error', message: 'Problem area not found.' });
       }
       return res.status(403).json({ status: 'error', message: 'Forbidden: Not authorized to delete this problem area.' });
    }

    const deletedProblemArea = await interviewRepository.deleteProblemArea(problemAreaId);

    res.json({ status: 'success', message: 'Problem area deleted successfully', data: deletedProblemArea }); // Optionally return deleted item

  } catch (error: any) {
    console.error(`[DELETE /problem_areas/:id] Error deleting problem area ${req.params.id}:`, error);
     // P2025 might occur if deleted between check and delete call, handle defensively
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.status(404).json({ status: 'error', message: 'Problem area not found.' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to delete problem area', error: isDevelopment ? error.message : undefined });
  }
});

// -------------------------------\n// Persona Endpoints (Existing)\n// -------------------------------
// GET personas for a specific user
app.get('/personas', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required query parameter: userId',
      });
    }
    console.log(`[DB Service] Fetching personas for user: ${userId}...`);
    const userPersonas = await personaRepository.findManyByUserId(userId);
    console.log(`[DB Service] Found ${userPersonas.length} personas for user ${userId}.`);
    res.json({
      status: 'success',
      message: 'User personas retrieved successfully',
      data: userPersonas,
    });
  } catch (error: any) {
    console.error('[DB Service] Error retrieving user personas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve user personas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Create a new persona for a specific user
app.post('/personas', async (req: Request, res: Response) => {
  try {
    const { userId, name, color } = req.body;
    if (!userId || !name || typeof name !== 'string' || name.trim().length === 0 || !color || typeof color !== 'string' || color.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing or invalid required fields: userId (string), name (non-empty string), and color (non-empty string) are required.',
      });
    }
    console.log(`[DB Service] Attempting to create persona '${name}' for user: ${userId} with color '${color}'...`);
    const newPersona = await personaRepository.createForUser(userId, name, color);
    console.log(`[DB Service] Persona created successfully: ID=${newPersona.id}`);
    res.status(201).json({
      status: 'success',
      message: 'Persona created successfully',
      data: newPersona,
    });
  } catch (error: any) {
    console.error('[DB Service] Error creating persona:', error);
    if (error.message.includes('already exists for this user')) {
      return res.status(409).json({ status: 'error', message: error.message });
    }
    if (error.message.includes('User with ID') && error.message.includes('not found')) {
        return res.status(404).json({ status: 'error', message: error.message });
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to create persona',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Update an existing persona for a specific user
app.put('/personas/:personaId', async (req: Request, res: Response) => {
  try {
    const { personaId } = req.params;
    const { userId, name, color } = req.body;
    if (!userId || !personaId || !name || typeof name !== 'string' || name.trim().length === 0 || !color || typeof color !== 'string' || color.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing or invalid fields: userId (string), name (non-empty string), color (non-empty string) in body, and personaId (in URL) are required.',
      });
    }
    console.log(`[DB Service] Attempting to update persona '${personaId}' for user: ${userId} with name '${name}' and color '${color}'...`);
    const updatedPersona = await personaRepository.updateForUser(userId, personaId, name, color);
    console.log(`[DB Service] Persona updated successfully: ID=${updatedPersona.id}`);
    res.json({
      status: 'success',
      message: 'Persona updated successfully',
      data: updatedPersona,
    });
  } catch (error: any) {
    console.error(`[DB Service] Error updating persona ${req.params.personaId}:`, error);
    if (error.message.includes('already exists for this user')) {
      return res.status(409).json({ status: 'error', message: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ status: 'error', message: error.message });
    }
    if (error.message.includes('not authorized')) {
      return res.status(403).json({ status: 'error', message: error.message });
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to update persona',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Delete a persona owned by a specific user
app.delete('/personas/:personaId', async (req: Request, res: Response) => {
  try {
    const { personaId } = req.params;
    const userId = req.query.userId as string;
    if (!userId || !personaId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameters: userId (query parameter) and personaId (URL parameter) are required.',
      });
    }
    console.log(`[DB Service] Attempting to delete persona '${personaId}' owned by user: ${userId}...`);
    const deletedPersona = await personaRepository.deleteForUser(userId, personaId);
    console.log(`[DB Service] Persona deleted successfully: ID=${deletedPersona.id}`);
    res.json({
      status: 'success',
      message: 'Persona deleted successfully',
      data: deletedPersona,
    });
  } catch (error: any) {
    console.error(`[DB Service] Error deleting persona ${req.params.personaId}:`, error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ status: 'error', message: error.message });
    }
    if (error.message.includes('not authorized')) {
      return res.status(403).json({ status: 'error', message: error.message });
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete persona',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// -------------------------------\n// Project Endpoints (Existing)\n// -------------------------------
// GET projects for a user
app.get('/projects', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required query parameter: userId',
      });
    }
    console.log(`[DB Service] Fetching projects for user: ${userId}, Limit: ${limit}, Offset: ${offset}`);
    const where = { ownerId: userId };
    const [projects, total] = await Promise.all([
      projectRepository.findMany({
        take: limit,
        skip: offset,
        where: where,
      }),
      projectRepository.count({ where: where })
    ]);
    console.log(`[DB Service] Found ${projects.length} projects, Total: ${total}`);
    res.json({
      status: 'success',
      message: 'Projects retrieved successfully',
      data: { 
        projects,
        total,
        limit,
        offset,
        hasMore: offset + projects.length < total
      }
    });
  } catch (error: any) {
    console.error('[DB Service] Error retrieving projects:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve projects',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create a new project
app.post('/projects', async (req: Request, res: Response) => {
  try {
    const { name, description, ownerId } = req.body;
    if (!name || !ownerId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: name and ownerId are required.',
      });
    }
    console.log(`[DB Service] Attempting to create project: Name=${name}, Owner=${ownerId}`);
    const projectData = {
      name: name,
      description: description,
      owner: { connect: { id: ownerId } }
    };
    const project = await projectRepository.create(projectData);
    console.log(`[DB Service] Project created successfully: ID=${project.id}`);
    res.status(201).json({
      status: 'success',
      message: 'Project created successfully',
      data: project
    });
  } catch (error: any) {
    console.error('[DB Service] Error creating project:', error);
    if (error.message.includes('Related owner user not found')) {
      console.warn(`[DB Service] Failed to create project: Owner user '${req.body.ownerId}' not found.`);
      return res.status(400).json({
        status: 'error',
        message: `Failed to create project: Owner user with ID '${req.body.ownerId}' not found.`,
      });
    }
    if (error.code === 'P2002') {
       console.warn(`[DB Service] Failed to create project: Name '${req.body.name}' likely already exists for owner '${req.body.ownerId}'.`);
       return res.status(409).json({
         status: 'error',
         message: `Project with name "${req.body.name}" already exists for this user.`,
       });
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to create project',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET Project Details by ID
app.get('/projects/:projectId', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = req.query.userId as string; // Get userId from query param passed by gateway

  console.log(`[DB Service] Fetching details for project: ${projectId}, requested by user: ${userId}`);

  // Basic validation
  if (!projectId) {
    return res.status(400).json({ status: 'error', message: 'Project ID is required.' });
  }
  if (!userId) {
    // Gateway should always pass this based on verified token
    return res.status(401).json({ status: 'error', message: 'User ID is required for authorization.' });
  }

  try {
    // Use Prisma client directly to find the project
    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
        // IMPORTANT: Authorizaton Check - Ensure the requesting user owns the project
        ownerId: userId
      },
      include: { // Include details needed by the frontend
        owner: { select: { name: true } }, // Example: Owner's name
        _count: { select: { interviews: true } } // Example: Interview count
      }
    });

    if (!project) {
      // Could be not found OR user doesn't own it
      console.warn(`[DB Service] Project ${projectId} not found or user ${userId} not authorized.`);
      // Check if project exists at all to differentiate 404 vs 403 (optional)
      // const exists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
      // if (!exists) return res.status(404).json({ status: 'error', message: 'Project not found.' });
      return res.status(404).json({ status: 'error', message: 'Project not found or access denied.' }); // Keep 404 generic for security
    }

    console.log(`[DB Service] Found project details for ${projectId}.`);
    res.json({
      status: 'success',
      message: 'Project details retrieved successfully',
      data: project // Return the full project object (matches ProjectDetailResponse)
    });

  } catch (error: any) {
    console.error(`[DB Service] Error retrieving project details for ${projectId}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve project details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET CONFIRMED Problem Areas for a specific Project
app.get('/projects/:projectId/problem-areas', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  console.log(`[DB Service] Fetching confirmed problem areas for project: ${projectId}`);
  try {
    if (!projectId) {
      return res.status(400).json({ status: 'error', message: 'Project ID is required.' });
    }
    // Use prisma client directly
    const problemAreas = await prisma.problemArea.findMany({
      where: {
        is_confirmed: true, // Filter: Only confirmed
        interview: { project_id: projectId } // Filter: Belongs to the project
      },
      include: {
        interview: { // Include necessary interview context
          select: {
            id: true,
            title: true,
            personas: { // Include interview's personas
              select: { id: true, name: true, color: true }
            }
          }
        },
        excerpts: true // Include excerpts for the detail panel view
      },
      orderBy: { created_at: 'desc' }
    });
    console.log(`[DB Service] Found ${problemAreas.length} confirmed problem areas for project ${projectId}.`);
    res.json({
      status: 'success',
      message: 'Confirmed problem areas retrieved successfully',
      data: { problemAreas: problemAreas } // Key matches frontend expectation
    });
  } catch (error: any) {
    console.error(`[DB Service] Error retrieving problem areas for project ${projectId}:`, error);
    if (error.code === 'P2025') { // Handle case where project might not exist
         return res.status(404).json({ status: 'error', message: 'Project or related resource not found.' });
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve problem areas for project',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET Interviews for a specific Project
app.get('/projects/:projectId/interviews', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  console.log(`[DB Service] Fetching interviews for project: ${projectId}`);
  try {
    if (!projectId) {
      return res.status(400).json({ status: 'error', message: 'Project ID is required.' });
    }
    // Use prisma client directly or repository instance
    const interviews = await prisma.interview.findMany({ // Using prisma directly for simplicity here
      where: { project_id: projectId }, // Filter by project_id
      select: { // Select only fields needed for the list panel
        id: true,
        title: true,
        participants: true,
        created_at: true
      },
      orderBy: { created_at: 'desc' }
    });
    console.log(`[DB Service] Found ${interviews.length} interviews for project ${projectId}.`);
    res.json({
      status: 'success',
      message: 'Interviews retrieved successfully for project',
      data: { interviews: interviews }
    });
  } catch (error: any) {
    console.error(`[DB Service] Error retrieving interviews for project ${projectId}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve interviews for project',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// -------------------------------\n// Interview Endpoints (MODIFIED)\n// -------------------------------

// Get all interviews with pagination (Uses findManyWithRelations)
app.get('/interviews', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const userId = req.query.userId as string;
    
    const where = userId ? { userId } : {}; 

    // Uses findManyWithRelations, which now includes ProblemAreas/Excerpts
    const [interviews, total] = await Promise.all([
      interviewRepository.findManyWithRelations({
        take: limit,
        skip: offset,
        where: where,
        orderBy: { created_at: 'desc' }
      }),
      interviewRepository.count(where) 
    ]);

    res.json({
      status: 'success',
      message: 'Interviews retrieved successfully',
      data: { interviews, total, limit, offset, hasMore: offset + interviews.length < total }
    });
  } catch (error: any) {
    console.error('Error retrieving interviews:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve interviews',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get interview by ID (Uses findByIdWithRelations)
app.get('/interviews/:id', async (req: Request, res: Response) => {
  try {
    // Uses findByIdWithRelations, which now includes ProblemAreas/Excerpts
    const interview = await interviewRepository.findByIdWithRelations(req.params.id);
    
    if (!interview) {
      return res.status(404).json({
        status: 'error',
        message: 'Interview not found'
      });
    }
    
    // Auth check: Ensure user owns the interview
    const requestedUserId = req.query.userId as string;
    if (requestedUserId && interview.userId && interview.userId !== requestedUserId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this interview'
      });
    }
    
    res.json({
      status: 'success',
      message: 'Interview retrieved successfully',
      data: interview
    });
  } catch (error: any) {
    console.error(`Error retrieving interview ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve interview',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create a new interview (MODIFIED to handle problemAreasData)
app.post('/interviews', async (req: Request, res: Response) => {
  try {
    console.log("[POST /interviews] Received request body keys:", Object.keys(req.body));
    
    // Destructure expected fields, including optional problemAreasData
    const { title, problem_count, transcript_length, analysis_data, userId, project_id, problemAreasData } = req.body;
    
    // Basic validation for core fields
    if (!title || problem_count === undefined || transcript_length === undefined || !analysis_data) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields for interview base',
        required: ['title', 'problem_count', 'transcript_length', 'analysis_data']
      });
    }

    // Validate problemAreasData structure if present (basic check)
    if (problemAreasData && !Array.isArray(problemAreasData)) {
       return res.status(400).json({ status: 'error', message: 'Invalid format for problemAreasData: Must be an array.' });
    }
    // Add deeper validation if needed (e.g., check structure of each problem area/excerpt)
    
    let participantsString: string | null = null;
    if (analysis_data?.participants && Array.isArray(analysis_data.participants)) {
      participantsString = analysis_data.participants.join(', ');
    } 

    const effectiveUserId = userId || req.query.userId as string || undefined;
    
    // Prepare base interview data, excluding the relation field 'problemAreas'
    const interviewBaseData: Omit<Prisma.InterviewCreateInput, 'problemAreas'> = {
      title: title,
      problem_count: problem_count,
      transcript_length: transcript_length,
      analysis_data: analysis_data || Prisma.JsonNull, // Keep JSON blob for now
      participants: participantsString,
      user: effectiveUserId ? { connect: { id: effectiveUserId } } : undefined,
      project: project_id ? { connect: { id: project_id } } : undefined,
    };

    // Call the updated repository create method
    const interview = await interviewRepository.create(interviewBaseData, problemAreasData);
    console.log(`[POST /interviews] Interview created successfully: ID=${interview.id}`);

    // Return only the base interview data (ID is most important here)
    res.status(201).json({
      status: 'success',
      message: 'Interview created successfully',
      data: { id: interview.id } // Return only ID, or fetch with relations if needed
    });

  } catch (error: any) {
    console.error('[POST /interviews] Error during interview creation:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create interview',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update interview by ID (Base fields only)
app.put('/interviews/:id', async (req: Request, res: Response) => {
  try {
    const interviewId = req.params.id;
    const { title, project_id, personaIds } = req.body; 
    const userId = req.query.userId as string; // For Auth check

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized: Missing user ID.' });
    }

    // Auth Check: Ensure user owns the interview before allowing update
    const existingInterview = await interviewRepository.findById(interviewId);
    if (!existingInterview) {
        return res.status(404).json({ status: 'error', message: 'Interview not found' });
    }
    if (existingInterview.userId !== userId) {
        return res.status(403).json({ status: 'error', message: 'Not authorized to update this interview' });
    }
    
    const dataToUpdate: Prisma.InterviewUpdateInput = {};
    if (title !== undefined) {
      dataToUpdate.title = title;
    }
    if (project_id !== undefined) {
      dataToUpdate.project = project_id === null ? { disconnect: true } : { connect: { id: project_id } };
    }
    if (personaIds !== undefined) {
      if (!Array.isArray(personaIds) || !personaIds.every(id => typeof id === 'string')) {
        return res.status(400).json({ status: 'error', message: 'Invalid format for personaIds: Must be an array of strings (persona IDs).' });
      }
      dataToUpdate.personas = { set: personaIds.map(id => ({ id: id })) };
    }

    console.log(`[DB Service] Attempting to update interview: ID=${interviewId}`, dataToUpdate);

    // Use repository method that includes relations in the response
    const updatedInterview = await interviewRepository.updateAndFetch(interviewId, dataToUpdate);

    res.json({
      status: 'success',
      message: 'Interview updated successfully',
      data: updatedInterview
    });

  } catch (error: any) {
    console.error('[PUT /interviews/:id] Error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.status(404).json({
            status: 'error',
            message: `Update failed: ${error.meta?.cause || 'Required record not found.'}`
        });
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to update interview',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete interview by ID
app.delete('/interviews/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string; // For Auth check

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized: Missing user ID.' });
    }
    
    // Check if interview exists and user ownership
    const existingInterview = await interviewRepository.findById(id);
    if (!existingInterview) {
      return res.status(404).json({
        status: 'error',
        message: 'Interview not found'
      });
    }
    if (existingInterview.userId !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to delete this interview'
      });
    }
    
    // Cascade delete will handle ProblemAreas/Excerpts
    await interviewRepository.delete(id);
    
    res.json({
      status: 'success',
      message: 'Interview deleted successfully'
    });
  } catch (error: any) {
    console.error(`Error deleting interview ${req.params.id}:`, error);
     if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.status(404).json({ status: 'error', message: 'Interview not found.' });
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete interview',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get single project by ID
app.get("/projects/:projectId", async (request, response) => {
  try {
    console.log("GET /projects/:projectId received");

    const projectId = request.params.projectId;
    const project = await projectRepository.findById(projectId);

    if (!project) {
      return response.status(404).send({
        error: `Project with ID ${projectId} not found`,
      });
    }

    response.json(project);
  } catch (error) {
    console.error("GET /projects/:projectId Error:", error);
    response.status(500).send({
      error: "Failed to get project",
    });
  }
});

// Update project by ID
app.put("/projects/:projectId", async (request, response) => {
  try {
    console.log("PUT /projects/:projectId received");
    const projectId = request.params.projectId;
    const userId = request.query.userId as string;
    
    if (!userId) {
      return response.status(400).send({
        status: "error",
        message: "User ID is required as a query parameter",
      });
    }
    
    const updateData = request.body;
    console.log(`Updating project ${projectId} with data:`, updateData);
    
    const updatedProject = await projectRepository.update(projectId, userId, updateData);
    // Return response format matching API gateway expectations
    response.json({
      status: "success",
      message: "Project updated successfully",
      data: updatedProject
    });
    
  } catch (error: any) {
    console.error("PUT /projects/:projectId Error:", error);
    
    if (error.message && (
        error.message.includes("not found") || 
        error.message.includes("Project not found")
    )) {
      return response.status(404).send({
        status: "error",
        message: error.message,
      });
    }
    
    if (error.message && error.message.includes("not authorized")) {
      return response.status(403).send({
        status: "error",
        message: error.message,
      });
    }
    
    response.status(500).send({
      status: "error",
      message: "Failed to update project",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete project by ID
app.delete("/projects/:projectId", async (request, response) => {
  try {
    console.log("DELETE /projects/:projectId received");
    const projectId = request.params.projectId;
    const userId = request.query.userId as string;
    const force = request.query.force === 'true'; // Check for force query parameter

    if (!userId) {
      return response.status(400).send({
        status: "error",
        message: "User ID is required as a query parameter",
      });
    }

    console.log(`Deleting project ${projectId} requested by user ${userId}${force ? ' (FORCE DELETE)' : ''}`);

    // Check if the project exists and is owned by the user first
    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
        ownerId: userId
      },
      select: { // Select only needed fields for validation
        id: true,
        ownerId: true,
        interviews: !force ? { select: { id: true } } : false // Only include interviews if not force deleting
      }
    });

    if (!project) {
      return response.status(404).send({
        status: "error",
        message: `Project not found or you don't have permission to delete it`,
      });
    }

    if (force) {
      // Force delete: Use transaction to delete related entities then the project
      console.log(`Force deleting project ${projectId} and its associated data.`);
      const deletedProject = await prisma.$transaction(async (tx) => {
        // 1. Delete Problem Areas associated with interviews of this project
        //    Need to find interviews first
        const interviewsToDelete = await tx.interview.findMany({
            where: { project_id: projectId },
            select: { id: true }
        });
        const interviewIds = interviewsToDelete.map(i => i.id);

        if (interviewIds.length > 0) {
            await tx.problemArea.deleteMany({
                where: { interview_id: { in: interviewIds } }
            });
            console.log(`Deleted problem areas associated with ${interviewIds.length} interviews of project ${projectId}.`);
        }

        // 2. Delete Interviews associated with this project
        await tx.interview.deleteMany({
          where: { project_id: projectId }
        });
        console.log(`Deleted interviews associated with project ${projectId}.`);

        // 3. Delete the Project itself
        const finalDeletedProject = await tx.project.delete({
          where: { id: projectId, ownerId: userId } // Ensure ownership again inside transaction
        });
        console.log(`Project ${projectId} successfully force deleted.`);
        return finalDeletedProject;
      });

      response.json({
        status: "success",
        message: "Project and all associated data deleted successfully (forced)",
        data: deletedProject // Return the deleted project data
      });

    } else {
      // Standard delete: Check for interviews first
      if (project.interviews && project.interviews.length > 0) {
        return response.status(409).send({
          status: "error",
          message: `Cannot delete project: It still contains ${project.interviews.length} interviews. Use force delete or remove interviews first.`,
        });
      }

      // Proceed with standard deletion if no interviews
      const deletedProject = await prisma.project.delete({
        where: {
          id: projectId,
          ownerId: userId // Re-check ownership for safety
        }
      });

      console.log(`Project ${projectId} successfully deleted (standard)`);

      response.json({
        status: "success",
        message: "Project deleted successfully",
        data: deletedProject
      });
    }

  } catch (error: any) {
    console.error("DELETE /projects/:projectId Error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Handle specific Prisma errors if needed, e.g., P2025 for record not found during delete attempt
         if (error.code === 'P2025') {
            return response.status(404).send({
                status: "error",
                message: "Project not found during delete operation.",
            });
        }
    } else if (error.message && error.message.includes("not authorized")) {
        // Keep existing authorization check if projectRepository throws it
        return response.status(403).send({
            status: "error",
            message: error.message,
        });
    }

    response.status(500).send({
      status: "error",
      message: "Failed to delete project",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start the server
const PORT = process.env.PORT || 5001;
const environment = process.env.NODE_ENV || 'development';
console.log(`Starting database service in ${environment} mode`);
console.log(`Using PORT=${PORT} (default: 5001 for local, 8080 for Cloud Run)`);

app.listen(PORT, () => {
  console.log(`Database API server running on port ${PORT}`);
});