import { Router, Request, Response } from 'express';
import { db } from '../db';
import { prompts, promptVersions } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createPromptSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  content: z.string().min(1),
  systemPrompt: z.string().optional(),
  variables: z.array(z.string()).optional(),
});

const updatePromptSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

const createVersionSchema = z.object({
  content: z.string().min(1),
  systemPrompt: z.string().optional(),
  variables: z.array(z.string()).optional(),
});

// List all prompts
router.get('/', async (_req: Request, res: Response) => {
  try {
    const allPrompts = await db.select().from(prompts).orderBy(desc(prompts.updatedAt));
    res.json(allPrompts);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// Get a single prompt with its versions
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const prompt = await db.select().from(prompts).where(eq(prompts.id, req.params.id)).limit(1);
    if (prompt.length === 0) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }

    const versions = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.promptId, req.params.id))
      .orderBy(desc(promptVersions.version));

    res.json({ ...prompt[0], versions });
  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

// Create a new prompt with initial version
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createPromptSchema.parse(req.body);
    const now = new Date();
    const promptId = uuidv4();
    const versionId = uuidv4();

    await db.insert(prompts).values({
      id: promptId,
      name: data.name,
      description: data.description,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(promptVersions).values({
      id: versionId,
      promptId,
      version: 1,
      content: data.content,
      systemPrompt: data.systemPrompt,
      variables: data.variables ? JSON.stringify(data.variables) : null,
      createdAt: now,
      isActive: true,
    });

    res.status(201).json({
      id: promptId,
      name: data.name,
      description: data.description,
      createdAt: now,
      updatedAt: now,
      currentVersion: {
        id: versionId,
        version: 1,
        content: data.content,
        systemPrompt: data.systemPrompt,
        variables: data.variables,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Error creating prompt:', error);
    res.status(500).json({ error: 'Failed to create prompt' });
  }
});

// Update a prompt's metadata
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const data = updatePromptSchema.parse(req.body);
    const now = new Date();

    await db
      .update(prompts)
      .set({ ...data, updatedAt: now })
      .where(eq(prompts.id, req.params.id));

    const updated = await db.select().from(prompts).where(eq(prompts.id, req.params.id)).limit(1);
    
    if (updated.length === 0) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }

    res.json(updated[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Error updating prompt:', error);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

// Delete a prompt and all its versions
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Delete versions first (foreign key constraint)
    await db.delete(promptVersions).where(eq(promptVersions.promptId, req.params.id));
    await db.delete(prompts).where(eq(prompts.id, req.params.id));
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting prompt:', error);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

// Create a new version of a prompt
router.post('/:id/versions', async (req: Request, res: Response) => {
  try {
    const data = createVersionSchema.parse(req.body);
    
    // Get current max version
    const currentVersions = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.promptId, req.params.id))
      .orderBy(desc(promptVersions.version))
      .limit(1);

    const newVersion = (currentVersions[0]?.version || 0) + 1;
    const versionId = uuidv4();
    const now = new Date();

    // Deactivate all existing versions
    await db
      .update(promptVersions)
      .set({ isActive: false })
      .where(eq(promptVersions.promptId, req.params.id));

    // Create new version
    await db.insert(promptVersions).values({
      id: versionId,
      promptId: req.params.id,
      version: newVersion,
      content: data.content,
      systemPrompt: data.systemPrompt,
      variables: data.variables ? JSON.stringify(data.variables) : null,
      createdAt: now,
      isActive: true,
    });

    // Update prompt's updatedAt
    await db
      .update(prompts)
      .set({ updatedAt: now })
      .where(eq(prompts.id, req.params.id));

    res.status(201).json({
      id: versionId,
      promptId: req.params.id,
      version: newVersion,
      content: data.content,
      systemPrompt: data.systemPrompt,
      variables: data.variables,
      createdAt: now,
      isActive: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Error creating version:', error);
    res.status(500).json({ error: 'Failed to create version' });
  }
});

// Get a specific version
router.get('/:id/versions/:versionId', async (req: Request, res: Response) => {
  try {
    const version = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.id, req.params.versionId))
      .limit(1);

    if (version.length === 0) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }

    res.json(version[0]);
  } catch (error) {
    console.error('Error fetching version:', error);
    res.status(500).json({ error: 'Failed to fetch version' });
  }
});

// Set a version as active
router.post('/:id/versions/:versionId/activate', async (req: Request, res: Response) => {
  try {
    // Deactivate all versions
    await db
      .update(promptVersions)
      .set({ isActive: false })
      .where(eq(promptVersions.promptId, req.params.id));

    // Activate the specified version
    await db
      .update(promptVersions)
      .set({ isActive: true })
      .where(eq(promptVersions.id, req.params.versionId));

    const version = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.id, req.params.versionId))
      .limit(1);

    res.json(version[0]);
  } catch (error) {
    console.error('Error activating version:', error);
    res.status(500).json({ error: 'Failed to activate version' });
  }
});

export default router;
