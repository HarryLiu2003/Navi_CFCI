import express, { Request, Response } from 'express';
import cors from 'cors';
import { InterviewRepository } from '../repositories/interviewRepository';
import { ProjectRepository } from '../repositories/projectRepository';
import { json } from 'body-parser';
import { Prisma } from '@prisma/client';

// Initialize Express app
const app = express();
const interviewRepository = new InterviewRepository();
const projectRepository = new ProjectRepository();

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

// Get all interviews with pagination
app.get('/interviews', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const userId = req.query.userId as string;
    
    // Create where clause to filter by userId when provided
    const where = userId ? { userId } : undefined;
    
    // Get both interviews and count in parallel for better performance
    const [interviews, total] = await Promise.all([
      interviewRepository.findMany({
        take: limit,
        skip: offset,
        where,
        orderBy: { created_at: 'desc' }
      }),
      interviewRepository.count(where)
    ]);
    
    res.json({
      status: 'success',
      message: 'Interviews retrieved successfully',
      data: { 
        interviews,
        total,
        limit,
        offset,
        hasMore: offset + interviews.length < total
      }
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

// Get interview by ID
app.get('/interviews/:id', async (req: Request, res: Response) => {
  try {
    const interview = await interviewRepository.findById(req.params.id);
    
    if (!interview) {
      return res.status(404).json({
        status: 'error',
        message: 'Interview not found'
      });
    }
    
    // Check if userId is provided and matches the interview's userId
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

// Create a new interview
app.post('/interviews', async (req: Request, res: Response) => {
  try {
    console.log("[POST /interviews] Received request body:", JSON.stringify(req.body, null, 2));
    
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
      console.log(`[POST /interviews] Extracted participants string: "${participantsString}"`);
    } else {
      console.log("[POST /interviews] No participants found or invalid format in analysis_data.");
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
    };

    console.log("[POST /interviews] Data prepared for interview repository:", JSON.stringify(interviewData, null, 2));
    
    // Create the interview first
    const interview = await interviewRepository.create(interviewData);
    console.log(`[POST /interviews] Interview created successfully: ID=${interview.id}`);

    // --- BEGIN PROJECT UPDATE --- 
    // If a project_id was provided with the interview, update its timestamp
    if (project_id) {
      try {
        console.log(`[POST /interviews] Interview assigned to project ${project_id}. Attempting to update project timestamp.`);
        // Explicitly update the project's updatedAt field
        await projectRepository.update(project_id, { updatedAt: new Date() }); 
        console.log(`[POST /interviews] Successfully updated project ${project_id} updatedAt timestamp.`);
      } catch (projectUpdateError: any) {
        // Log a warning but don't fail the request - interview creation was successful
        console.warn(`[POST /interviews] WARNING: Failed to update project ${project_id} timestamp after creating interview ${interview.id}. Error: ${projectUpdateError.message}`);
      }
    } else {
      console.log(`[POST /interviews] Interview ${interview.id} created without project assignment. Skipping project update.`);
    }
    // --- END PROJECT UPDATE --- 

    // Return success response for the interview creation
    res.status(201).json({
      status: 'success',
      message: 'Interview created successfully',
      data: interview // Return the created interview data
    });

  } catch (error: any) {
    console.error('[POST /interviews] Error during interview creation or project update:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create interview',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update an interview
app.put('/interviews/:id', async (req: Request, res: Response) => {
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
    const requestedUserId = req.query.userId as string || req.body.userId;
    if (requestedUserId && existingInterview.userId && existingInterview.userId !== requestedUserId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to modify this interview'
      });
    }
    
    const updatedInterview = await interviewRepository.update(id, req.body);
    
    res.json({
      status: 'success',
      message: 'Interview updated successfully',
      data: updatedInterview
    });
  } catch (error: any) {
    console.error(`Error updating interview ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update interview',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete an interview
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