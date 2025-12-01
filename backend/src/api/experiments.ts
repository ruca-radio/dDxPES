import { Router, Request, Response } from 'express';
import { db } from '../db';
import { experiments, experimentResults, promptVersions } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { LLMAdapter, ProviderType } from '../llm';

const router = Router();
const llmAdapter = new LLMAdapter();

// Validation schemas
const createExperimentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  promptVersionId: z.string().uuid(),
  provider: z.enum(['openai', 'anthropic', 'gemini', 'local']),
  model: z.string().min(1),
  parameters: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().positive().optional(),
    topP: z.number().min(0).max(1).optional(),
  }).optional(),
});

const runExperimentSchema = z.object({
  inputs: z.array(z.record(z.string())),
});

// List all experiments
router.get('/', async (_req: Request, res: Response) => {
  try {
    const allExperiments = await db
      .select()
      .from(experiments)
      .orderBy(desc(experiments.createdAt));
    res.json(allExperiments);
  } catch (error) {
    console.error('Error fetching experiments:', error);
    res.status(500).json({ error: 'Failed to fetch experiments' });
  }
});

// Get a single experiment with results
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const experiment = await db
      .select()
      .from(experiments)
      .where(eq(experiments.id, req.params.id))
      .limit(1);
    
    if (experiment.length === 0) {
      res.status(404).json({ error: 'Experiment not found' });
      return;
    }

    const results = await db
      .select()
      .from(experimentResults)
      .where(eq(experimentResults.experimentId, req.params.id))
      .orderBy(desc(experimentResults.createdAt));

    res.json({ ...experiment[0], results });
  } catch (error) {
    console.error('Error fetching experiment:', error);
    res.status(500).json({ error: 'Failed to fetch experiment' });
  }
});

// Create a new experiment
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createExperimentSchema.parse(req.body);
    const experimentId = uuidv4();
    const now = new Date();

    // Verify prompt version exists
    const version = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.id, data.promptVersionId))
      .limit(1);

    if (version.length === 0) {
      res.status(400).json({ error: 'Prompt version not found' });
      return;
    }

    await db.insert(experiments).values({
      id: experimentId,
      name: data.name,
      description: data.description,
      promptVersionId: data.promptVersionId,
      provider: data.provider,
      model: data.model,
      parameters: data.parameters ? JSON.stringify(data.parameters) : null,
      status: 'pending',
      createdAt: now,
    });

    res.status(201).json({
      id: experimentId,
      name: data.name,
      description: data.description,
      promptVersionId: data.promptVersionId,
      provider: data.provider,
      model: data.model,
      parameters: data.parameters,
      status: 'pending',
      createdAt: now,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Error creating experiment:', error);
    res.status(500).json({ error: 'Failed to create experiment' });
  }
});

// Run an experiment with inputs
router.post('/:id/run', async (req: Request, res: Response) => {
  try {
    const data = runExperimentSchema.parse(req.body);
    
    // Get experiment
    const experiment = await db
      .select()
      .from(experiments)
      .where(eq(experiments.id, req.params.id))
      .limit(1);

    if (experiment.length === 0) {
      res.status(404).json({ error: 'Experiment not found' });
      return;
    }

    const exp = experiment[0];

    // Get prompt version
    const version = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.id, exp.promptVersionId))
      .limit(1);

    if (version.length === 0) {
      res.status(400).json({ error: 'Prompt version not found' });
      return;
    }

    const promptVersion = version[0];
    const provider = llmAdapter.getProvider(exp.provider as ProviderType);
    const parameters = exp.parameters ? JSON.parse(exp.parameters) : {};

    // Update experiment status
    await db
      .update(experiments)
      .set({ status: 'running' })
      .where(eq(experiments.id, req.params.id));

    const results = [];

    for (const input of data.inputs) {
      const resultId = uuidv4();
      const now = new Date();

      try {
        // Replace variables in prompt
        let content = promptVersion.content;
        for (const [key, value] of Object.entries(input)) {
          content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }

        // Build messages
        const messages = [];
        if (promptVersion.systemPrompt) {
          messages.push({ role: 'system' as const, content: promptVersion.systemPrompt });
        }
        messages.push({ role: 'user' as const, content });

        // Call LLM
        const response = await provider.chat({
          messages,
          model: exp.model,
          temperature: parameters.temperature,
          maxTokens: parameters.maxTokens,
          topP: parameters.topP,
        });

        // Save result
        await db.insert(experimentResults).values({
          id: resultId,
          experimentId: req.params.id,
          input: JSON.stringify(input),
          output: response.content,
          latencyMs: response.latencyMs,
          tokenCount: response.tokenUsage?.totalTokens,
          createdAt: now,
        });

        results.push({
          id: resultId,
          input,
          output: response.content,
          latencyMs: response.latencyMs,
          tokenCount: response.tokenUsage?.totalTokens,
        });
      } catch (error) {
        console.error('Error running input:', error);
        results.push({
          id: resultId,
          input,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update experiment status
    await db
      .update(experiments)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(experiments.id, req.params.id));

    res.json({ experimentId: req.params.id, results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Error running experiment:', error);
    
    // Update experiment status on error
    await db
      .update(experiments)
      .set({ status: 'failed' })
      .where(eq(experiments.id, req.params.id));

    res.status(500).json({ error: 'Failed to run experiment' });
  }
});

// Delete an experiment
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Delete results first
    await db.delete(experimentResults).where(eq(experimentResults.experimentId, req.params.id));
    await db.delete(experiments).where(eq(experiments.id, req.params.id));
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting experiment:', error);
    res.status(500).json({ error: 'Failed to delete experiment' });
  }
});

export default router;
