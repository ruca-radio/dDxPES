import { Router, Request, Response } from 'express';
import { db } from '../db';
import { apeCandidates, apeRuns, promptVersions } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { LLMAdapter, ProviderType } from '../llm';
import { APEEngine, APEConfig } from '../ape';

const router = Router();
const llmAdapter = new LLMAdapter();
const apeEngine = new APEEngine(llmAdapter);

// Validation schemas
const startAPERunSchema = z.object({
  promptVersionId: z.string().uuid(),
  strategy: z.enum(['mutation', 'generation', 'refinement']),
  iterations: z.number().min(1).max(20).default(5),
  provider: z.enum(['openai', 'anthropic', 'gemini', 'local']),
  model: z.string().min(1),
  evaluationCriteria: z.array(z.string()).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const evaluateCandidateSchema = z.object({
  testInputs: z.array(z.string()),
  expectedPatterns: z.array(z.string()).optional(),
  provider: z.enum(['openai', 'anthropic', 'gemini', 'local']),
  model: z.string().min(1),
});

// List all APE runs
router.get('/runs', async (_req: Request, res: Response) => {
  try {
    const runs = await db
      .select()
      .from(apeRuns)
      .orderBy(desc(apeRuns.createdAt));
    res.json(runs);
  } catch (error) {
    console.error('Error fetching APE runs:', error);
    res.status(500).json({ error: 'Failed to fetch APE runs' });
  }
});

// Get a specific APE run with candidates
router.get('/runs/:id', async (req: Request, res: Response) => {
  try {
    const run = await db
      .select()
      .from(apeRuns)
      .where(eq(apeRuns.id, req.params.id))
      .limit(1);

    if (run.length === 0) {
      res.status(404).json({ error: 'APE run not found' });
      return;
    }

    const candidates = await db
      .select()
      .from(apeCandidates)
      .where(eq(apeCandidates.sourcePromptVersionId, run[0].promptVersionId))
      .orderBy(desc(apeCandidates.createdAt));

    res.json({ ...run[0], candidates });
  } catch (error) {
    console.error('Error fetching APE run:', error);
    res.status(500).json({ error: 'Failed to fetch APE run' });
  }
});

// Start a new APE run
router.post('/runs', async (req: Request, res: Response) => {
  try {
    const data = startAPERunSchema.parse(req.body);
    const runId = uuidv4();
    const now = new Date();

    // Get prompt version
    const version = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.id, data.promptVersionId))
      .limit(1);

    if (version.length === 0) {
      res.status(400).json({ error: 'Prompt version not found' });
      return;
    }

    const promptVersion = version[0];

    // Create APE run record
    await db.insert(apeRuns).values({
      id: runId,
      promptVersionId: data.promptVersionId,
      strategy: data.strategy,
      iterations: data.iterations,
      status: 'running',
      config: JSON.stringify({
        provider: data.provider,
        model: data.model,
        evaluationCriteria: data.evaluationCriteria,
        temperature: data.temperature,
      }),
      createdAt: now,
    });

    // Start APE asynchronously
    const config: APEConfig = {
      strategy: data.strategy,
      iterations: data.iterations,
      provider: data.provider as ProviderType,
      model: data.model,
      evaluationCriteria: data.evaluationCriteria,
      temperature: data.temperature,
    };

    // Run APE in background
    apeEngine
      .generateCandidates(
        promptVersion.content,
        promptVersion.systemPrompt || undefined,
        config
      )
      .then(async (result) => {
        // Save candidates to database
        for (const candidate of result.candidates) {
          await db.insert(apeCandidates).values({
            id: candidate.id,
            sourcePromptVersionId: data.promptVersionId,
            candidateContent: candidate.content,
            candidateSystemPrompt: candidate.systemPrompt,
            score: candidate.score?.toString(),
            metrics: candidate.metrics ? JSON.stringify(candidate.metrics) : null,
            status: 'pending',
            createdAt: new Date(),
          });
        }

        // Update run status
        await db
          .update(apeRuns)
          .set({ status: 'completed', completedAt: new Date() })
          .where(eq(apeRuns.id, runId));
      })
      .catch(async (error) => {
        console.error('APE run failed:', error);
        await db
          .update(apeRuns)
          .set({ status: 'failed', completedAt: new Date() })
          .where(eq(apeRuns.id, runId));
      });

    res.status(202).json({
      id: runId,
      promptVersionId: data.promptVersionId,
      strategy: data.strategy,
      iterations: data.iterations,
      status: 'running',
      message: 'APE run started. Check status using GET /api/ape/runs/:id',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Error starting APE run:', error);
    res.status(500).json({ error: 'Failed to start APE run' });
  }
});

// List all candidates
router.get('/candidates', async (_req: Request, res: Response) => {
  try {
    const candidates = await db
      .select()
      .from(apeCandidates)
      .orderBy(desc(apeCandidates.createdAt));
    res.json(candidates);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// Get a specific candidate
router.get('/candidates/:id', async (req: Request, res: Response) => {
  try {
    const candidate = await db
      .select()
      .from(apeCandidates)
      .where(eq(apeCandidates.id, req.params.id))
      .limit(1);

    if (candidate.length === 0) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    res.json(candidate[0]);
  } catch (error) {
    console.error('Error fetching candidate:', error);
    res.status(500).json({ error: 'Failed to fetch candidate' });
  }
});

// Evaluate a candidate
router.post('/candidates/:id/evaluate', async (req: Request, res: Response) => {
  try {
    const data = evaluateCandidateSchema.parse(req.body);

    const candidate = await db
      .select()
      .from(apeCandidates)
      .where(eq(apeCandidates.id, req.params.id))
      .limit(1);

    if (candidate.length === 0) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    const cand = candidate[0];

    // Update status
    await db
      .update(apeCandidates)
      .set({ status: 'evaluating' })
      .where(eq(apeCandidates.id, req.params.id));

    // Evaluate candidate
    const evaluated = await apeEngine.evaluateCandidate(
      {
        id: cand.id,
        content: cand.candidateContent,
        systemPrompt: cand.candidateSystemPrompt || undefined,
      },
      data.testInputs,
      data.expectedPatterns || [],
      data.provider as ProviderType,
      data.model
    );

    // Update candidate with results
    await db
      .update(apeCandidates)
      .set({
        score: evaluated.score?.toString(),
        metrics: evaluated.metrics ? JSON.stringify(evaluated.metrics) : null,
        status: 'pending',
      })
      .where(eq(apeCandidates.id, req.params.id));

    res.json({
      id: cand.id,
      score: evaluated.score,
      metrics: evaluated.metrics,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Error evaluating candidate:', error);
    res.status(500).json({ error: 'Failed to evaluate candidate' });
  }
});

// Accept a candidate (create new prompt version)
router.post('/candidates/:id/accept', async (req: Request, res: Response) => {
  try {
    const candidate = await db
      .select()
      .from(apeCandidates)
      .where(eq(apeCandidates.id, req.params.id))
      .limit(1);

    if (candidate.length === 0) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    const cand = candidate[0];

    // Get source prompt version to find prompt ID
    const sourceVersion = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.id, cand.sourcePromptVersionId))
      .limit(1);

    if (sourceVersion.length === 0) {
      res.status(400).json({ error: 'Source prompt version not found' });
      return;
    }

    // Get current max version
    const currentVersions = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.promptId, sourceVersion[0].promptId))
      .orderBy(desc(promptVersions.version))
      .limit(1);

    const newVersion = (currentVersions[0]?.version || 0) + 1;
    const versionId = uuidv4();
    const now = new Date();

    // Deactivate all existing versions
    await db
      .update(promptVersions)
      .set({ isActive: false })
      .where(eq(promptVersions.promptId, sourceVersion[0].promptId));

    // Create new version from candidate
    await db.insert(promptVersions).values({
      id: versionId,
      promptId: sourceVersion[0].promptId,
      version: newVersion,
      content: cand.candidateContent,
      systemPrompt: cand.candidateSystemPrompt,
      variables: sourceVersion[0].variables,
      createdAt: now,
      isActive: true,
    });

    // Update candidate status
    await db
      .update(apeCandidates)
      .set({ status: 'accepted' })
      .where(eq(apeCandidates.id, req.params.id));

    res.json({
      message: 'Candidate accepted',
      newVersionId: versionId,
      version: newVersion,
    });
  } catch (error) {
    console.error('Error accepting candidate:', error);
    res.status(500).json({ error: 'Failed to accept candidate' });
  }
});

// Reject a candidate
router.post('/candidates/:id/reject', async (req: Request, res: Response) => {
  try {
    await db
      .update(apeCandidates)
      .set({ status: 'rejected' })
      .where(eq(apeCandidates.id, req.params.id));

    res.json({ message: 'Candidate rejected' });
  } catch (error) {
    console.error('Error rejecting candidate:', error);
    res.status(500).json({ error: 'Failed to reject candidate' });
  }
});

export default router;
