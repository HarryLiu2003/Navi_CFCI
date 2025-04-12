import express, { Request, Response } from 'express';
import cors from 'cors';
import { InterviewRepository } from '../repositories/interviewRepository';
import { ProjectRepository } from '../repositories/projectRepository';
import { json } from 'body-parser';
import { PrismaClient, Prisma } from '@prisma/client';
import { PersonaRepository } from '../repositories/personaRepository';
import { getPrismaClient } from '../client';

// Initialize Express app
const app = express();
const interviewRepository = new InterviewRepository();
const projectRepository = new ProjectRepository();
const personaRepository = new PersonaRepository();
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
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (corsOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(json());

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Database API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// -------------------------------
// Personas Endpoints (UPDATED)
// -------------------------------

// GET personas for a specific user
app.get('/personas', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    // Validate userId is provided
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required query parameter: userId',
      });
    }

    console.log(`[DB Service] Fetching personas for user: ${userId}...`);

    // Fetch personas owned by the user from the Persona table
    const userPersonas = await personaRepository.findManyByUserId(userId);
    // Assumption: personaRepository.findManyByUserId(userId) fetches personas 
    // ordered by name: { where: { userId }, orderBy: { name: 'asc' } }

    console.log(`[DB Service] Found ${userPersonas.length} personas for user ${userId}.`);

    res.json({
      status: 'success',
      message: 'User personas retrieved successfully',
      data: userPersonas, // Return the array of Persona objects { id, name, color }
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

    // Validate required fields
    if (!userId || !name || typeof name !== 'string' || name.trim().length === 0 || !color || typeof color !== 'string' || color.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing or invalid required fields: userId (string), name (non-empty string), and color (non-empty string) are required.',
      });
    }

    console.log(`[DB Service] Attempting to create persona '${name}' for user: ${userId} with color '${color}'...`);

    // Use the repository to create the persona (handles color assignment and uniqueness check)
    const newPersona = await personaRepository.createForUser(userId, name, color);

    console.log(`[DB Service] Persona created successfully: ID=${newPersona.id}`);

    res.status(201).json({
      status: 'success',
      message: 'Persona created successfully',
      data: newPersona, // Return the created Persona object { id, name, color, userId }
    });

  } catch (error: any) {
    console.error('[DB Service] Error creating persona:', error);
    // Handle specific errors thrown by the repository (e.g., duplicate name)
    if (error.message.includes('already exists for this user')) {
      return res.status(409).json({ // 409 Conflict
        status: 'error',
        message: error.message, 
      });
    }
    if (error.message.includes('User with ID') && error.message.includes('not found')) {
        return res.status(404).json({ 
            status: 'error',
            message: error.message,
        });
    }
    // Generic error
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

    // Validate required fields
    if (!userId || !personaId || !name || typeof name !== 'string' || name.trim().length === 0 || !color || typeof color !== 'string' || color.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing or invalid fields: userId (string), name (non-empty string), color (non-empty string) in body, and personaId (in URL) are required.',
      });
    }

    console.log(`[DB Service] Attempting to update persona '${personaId}' for user: ${userId} with name '${name}' and color '${color}'...`);

    // Use the repository to update the persona
    const updatedPersona = await personaRepository.updateForUser(userId, personaId, name, color);

    console.log(`[DB Service] Persona updated successfully: ID=${updatedPersona.id}`);

    res.json({
      status: 'success',
      message: 'Persona updated successfully',
      data: updatedPersona, // Return the updated Persona object
    });

  } catch (error: any) {
    console.error(`[DB Service] Error updating persona ${req.params.personaId}:`, error);
    // Handle specific errors from the repository
    if (error.message.includes('already exists for this user')) {
      return res.status(409).json({ status: 'error', message: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ status: 'error', message: error.message });
    }
    if (error.message.includes('not authorized')) {
      return res.status(403).json({ status: 'error', message: error.message });
    }
    // Generic error
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
    // IMPORTANT: userId for authorization should come from a verified source (e.g., query param added by gateway)
    // For now, we'll read it from query params as per other DELETE endpoints
    const userId = req.query.userId as string;

    // Validate required fields
    if (!userId || !personaId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameters: userId (query parameter) and personaId (URL parameter) are required.',
      });
    }

    console.log(`[DB Service] Attempting to delete persona '${personaId}' owned by user: ${userId}...`);

    // Use the repository to delete the persona
    const deletedPersona = await personaRepository.deleteForUser(userId, personaId);

    console.log(`[DB Service] Persona deleted successfully: ID=${deletedPersona.id}`);

    res.json({
      status: 'success',
      message: 'Persona deleted successfully',
      data: deletedPersona, // Optionally return the deleted object
    });

  } catch (error: any) {
    console.error(`[DB Service] Error deleting persona ${req.params.personaId}:`, error);
    // Handle specific errors from the repository
    if (error.message.includes('not found')) {
      return res.status(404).json({ status: 'error', message: error.message });
    }
    if (error.message.includes('not authorized')) {
      return res.status(403).json({ status: 'error', message: error.message });
    }
    // Generic error
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete persona',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// -------------------------------
// Project Endpoints
// -------------------------------

// GET projects for a user (NEW Endpoint)
app.get('/projects', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Default 50, max 100
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const userId = req.query.userId as string;

    // Validate userId is provided (required to fetch user's projects)
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required query parameter: userId',
      });
    }

    console.log(`[DB Service] Fetching projects for user: ${userId}, Limit: ${limit}, Offset: ${offset}`);

    // Define the where clause for filtering by ownerId
    const where = { ownerId: userId };

    // Get projects and count in parallel
    const [projects, total] = await Promise.all([
      projectRepository.findMany({
        take: limit,
        skip: offset,
        where: where,
        orderBy: { name: 'asc' } // Order by project name alphabetically
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

// Create a new project (Changed endpoint from /internal/projects to /projects)
app.post('/projects', async (req: Request, res: Response) => {
  try {
    const { name, description, ownerId } = req.body;

    // Validate required fields
    if (!name || !ownerId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: name and ownerId are required.',
      });
    }
    
    console.log(`[DB Service] Attempting to create project: Name=${name}, Owner=${ownerId}`);

    // Construct data in the format expected by ProjectRepository.create
    const projectData = {
      name: name,
      description: description,
      owner: {
        connect: { id: ownerId }
      }
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
    // Check if it's the specific 'Owner not found' error from the repository
    if (error.message.includes('Related owner user not found')) {
      console.warn(`[DB Service] Failed to create project: Owner user '${req.body.ownerId}' not found.`);
      return res.status(400).json({
        status: 'error',
        message: `Failed to create project: Owner user with ID '${req.body.ownerId}' not found.`,
      });
    }
    // Prisma Unique constraint failed?
    if (error.code === 'P2002') { // Check Prisma error code for unique constraint
       console.warn(`[DB Service] Failed to create project: Name '${req.body.name}' likely already exists for owner '${req.body.ownerId}'.`);
       return res.status(409).json({ // 409 Conflict
         status: 'error',
         message: `Project with name "${req.body.name}" already exists for this user.`,
       });
    }
    // Generic error
    res.status(500).json({
      status: 'error',
      message: 'Failed to create project',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// --- Add PUT /projects/:id and DELETE /projects/:id later if needed ---

// -------------------------------
// Interview Endpoints
// -------------------------------

// Get all interviews with pagination (Use direct client for include)
app.get('/interviews', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const userId = req.query.userId as string;
    
    const where = userId ? { userId } : {}; 

    // Use new repository method findManyWithRelations
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

// Get interview by ID (Use direct client for include)
app.get('/interviews/:id', async (req: Request, res: Response) => {
  try {
    // Use new repository method findByIdWithRelations
    const interview = await interviewRepository.findByIdWithRelations(req.params.id);
    
    if (!interview) {
      return res.status(404).json({
        status: 'error',
        message: 'Interview not found'
      });
    }
    
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

// Create a new interview (Use repository)
app.post('/interviews', async (req: Request, res: Response) => {
  try {
    console.log("[POST /interviews] Received request body:", JSON.stringify(req.body, null, 2));
    
    // Removed persona-related fields from direct creation
    const { title, problem_count, transcript_length, analysis_data, userId, project_id } = req.body;
    
    if (!title || problem_count === undefined || transcript_length === undefined || !analysis_data) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields',
        required: ['title', 'problem_count', 'transcript_length', 'analysis_data']
      });
    }
    
    let participantsString: string | null = null;
    if (analysis_data?.participants && Array.isArray(analysis_data.participants)) {
      participantsString = analysis_data.participants.join(', ');
    } 

    const effectiveUserId = userId || req.query.userId as string || undefined;
    
    const interviewData: Prisma.InterviewCreateInput = {
      title: title,
      problem_count: problem_count,
      transcript_length: transcript_length,
      analysis_data: analysis_data || Prisma.JsonNull,
      participants: participantsString,
      user: effectiveUserId ? { connect: { id: effectiveUserId } } : undefined,
      project: project_id ? { connect: { id: project_id } } : undefined,
      // Personas are NOT set on creation, handled via PUT /interviews/:id
    };

    const interview = await interviewRepository.create(interviewData);
    console.log(`[POST /interviews] Interview created successfully: ID=${interview.id}`);

    if (project_id) {
      try {
        await projectRepository.update(project_id, { updatedAt: new Date() }); 
        console.log(`[POST /interviews] Successfully updated project ${project_id} updatedAt timestamp.`);
      } catch (projectUpdateError: any) {
        console.warn(`[POST /interviews] WARNING: Failed to update project ${project_id} timestamp. Error: ${projectUpdateError.message}`);
      }
    } 

    res.status(201).json({
      status: 'success',
      message: 'Interview created successfully',
      data: interview 
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

// Update interview by ID (Use direct client for update and subsequent fetch)
app.put('/interviews/:id', async (req: Request, res: Response) => {
  try {
    const interviewId = req.params.id;
    const { title, project_id, personaIds } = req.body; 
    
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

    if (Object.keys(dataToUpdate).length === 0) {
      return res.status(400).json({ status: 'error', message: 'No valid fields provided for update (title, project_id, personaIds).' });
    }

    console.log(`[DB Service] Attempting to update interview: ID=${interviewId}`, dataToUpdate);

    // Use new repository method updateAndFetch
    const updatedInterview = await interviewRepository.updateAndFetch(interviewId, dataToUpdate);
    
    // No need to fetch again, updatedInterview already has relations
    // const updatedInterview = await prisma.interview.findUnique({
    //   where: { id: interviewId },
    //   include: { personas: true, project: true }
    // });
    
    // updatedInterview should always be defined if updateAndFetch succeeds
    // if (!updatedInterview) {
    //     return res.status(404).json({ status: 'error', message: 'Update failed or record not found.' });
    // }

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
    
    // Check if interview exists
    const existingInterview = await interviewRepository.findById(id);
    if (!existingInterview) {
      return res.status(404).json({
        status: 'error',
        message: 'Interview not found'
      });
    }
    
    // Check if userId is provided and matches the interview's userId
    const requestedUserId = req.query.userId as string;
    if (requestedUserId && existingInterview.userId && existingInterview.userId !== requestedUserId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to delete this interview'
      });
    }
    
    await interviewRepository.delete(id);
    
    res.json({
      status: 'success',
      message: 'Interview deleted successfully'
    });
  } catch (error: any) {
    console.error(`Error deleting interview ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete interview',
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