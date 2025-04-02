import express, { Request, Response } from 'express';
import cors from 'cors';
import { InterviewRepository } from '../repositories/interviewRepository';
import { json } from 'body-parser';

// Initialize Express app
const app = express();
const interviewRepository = new InterviewRepository();

// Configure CORS for both development and production
const allowedOrigins = [
  // Development origins
  'http://localhost:3000',           // Frontend (local)
  'http://localhost:8000',           // API Gateway (local)
  'http://frontend:3000',            // Frontend (Docker)
  'http://api_gateway:8000',         // API Gateway (Docker)
  
  // Production origins - replace with your actual domains
  'https://navi-cfci.vercel.app',    // Vercel frontend (update with your domain)
  'https://api-gateway-xxxx-uc.a.run.app'  // Cloud Run API Gateway (update with your URL)
];

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
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
    // Validate required fields
    const { title, problem_count, transcript_length, analysis_data, userId } = req.body;
    
    if (!title || problem_count === undefined || transcript_length === undefined || !analysis_data) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields',
        required: ['title', 'problem_count', 'transcript_length', 'analysis_data']
      });
    }
    
    // Create the interview with the provided data
    const interviewData = {
      ...req.body,
      // If userId is provided in the body or query, use it
      userId: userId || req.query.userId as string || undefined
    };
    
    const interview = await interviewRepository.create(interviewData);
    
    res.status(201).json({
      status: 'success',
      message: 'Interview created successfully',
      data: interview
    });
  } catch (error: any) {
    console.error('Error creating interview:', error);
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
app.listen(PORT, () => {
  console.log(`Database API server running on port ${PORT}`);
}); 