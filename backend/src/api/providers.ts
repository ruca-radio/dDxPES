import { Router, Request, Response } from 'express';
import { LLMAdapter, ProviderType } from '../llm';

const router = Router();
const llmAdapter = new LLMAdapter();

// List available providers and their models
router.get('/', async (_req: Request, res: Response) => {
  try {
    const providers = await llmAdapter.listProviders();
    res.json(providers);
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

// Get models for a specific provider
router.get('/:provider/models', async (req: Request, res: Response) => {
  try {
    const providerType = req.params.provider as ProviderType;
    const provider = llmAdapter.getProvider(providerType);
    const models = await provider.listModels();
    res.json(models);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Test a provider connection
router.post('/:provider/test', async (req: Request, res: Response) => {
  try {
    const providerType = req.params.provider as ProviderType;
    const provider = llmAdapter.getProvider(providerType);
    
    const response = await provider.chat({
      messages: [{ role: 'user', content: 'Say "Hello, Prompt Lab!" and nothing else.' }],
      model: req.body.model || 'gpt-4o-mini',
      maxTokens: 50,
    });

    res.json({
      success: true,
      response: response.content,
      latencyMs: response.latencyMs,
    });
  } catch (error) {
    console.error('Error testing provider:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
