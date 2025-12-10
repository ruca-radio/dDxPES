import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './db';
import { promptsRouter, experimentsRouter, apeRouter, providersRouter } from './api';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize database
initializeDatabase();

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/prompts', promptsRouter);
app.use('/api/experiments', experimentsRouter);
app.use('/api/ape', apeRouter);
app.use('/api/providers', providersRouter);

// Error handling middleware with structured logging
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Log error details for debugging (in production, use a proper logger)
  const errorId = Date.now().toString(36);
  console.error(`[${errorId}] Unhandled error:`, {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
  
  // Return generic error to client without exposing internal details
  res.status(500).json({ 
    error: 'Internal server error',
    errorId, // Allow correlation with server logs
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Prompt Lab API server running on http://localhost:${PORT}`);
  console.log(`📚 API endpoints:`);
  console.log(`   - GET  /health`);
  console.log(`   - GET  /api/prompts`);
  console.log(`   - GET  /api/experiments`);
  console.log(`   - GET  /api/ape/runs`);
  console.log(`   - GET  /api/providers`);
});

export default app;
