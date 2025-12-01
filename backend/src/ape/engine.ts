import { LLMAdapter, LLMMessage, ProviderType } from '../llm';
import { v4 as uuidv4 } from 'uuid';

export interface APEConfig {
  strategy: 'mutation' | 'generation' | 'refinement';
  iterations: number;
  provider: ProviderType;
  model: string;
  evaluationCriteria?: string[];
  temperature?: number;
}

export interface APECandidate {
  id: string;
  content: string;
  systemPrompt?: string;
  score?: number;
  metrics?: Record<string, number>;
}

export interface APEResult {
  runId: string;
  candidates: APECandidate[];
  bestCandidate?: APECandidate;
  iterations: number;
}

export class APEEngine {
  private llmAdapter: LLMAdapter;

  constructor(llmAdapter: LLMAdapter) {
    this.llmAdapter = llmAdapter;
  }

  async generateCandidates(
    originalPrompt: string,
    originalSystemPrompt: string | undefined,
    config: APEConfig
  ): Promise<APEResult> {
    const runId = uuidv4();
    const candidates: APECandidate[] = [];
    const provider = this.llmAdapter.getProvider(config.provider);

    for (let i = 0; i < config.iterations; i++) {
      try {
        let candidate: APECandidate;

        switch (config.strategy) {
          case 'mutation':
            candidate = await this.mutatePrompt(
              originalPrompt,
              originalSystemPrompt,
              provider,
              config
            );
            break;
          case 'generation':
            candidate = await this.generateNewPrompt(
              originalPrompt,
              originalSystemPrompt,
              provider,
              config
            );
            break;
          case 'refinement':
            candidate = await this.refinePrompt(
              originalPrompt,
              originalSystemPrompt,
              provider,
              config
            );
            break;
          default:
            throw new Error(`Unknown strategy: ${config.strategy}`);
        }

        candidates.push(candidate);
      } catch (error) {
        console.error(`APE iteration ${i + 1} failed:`, error);
      }
    }

    // Find the best candidate based on score
    const bestCandidate = candidates.reduce((best, current) => {
      if (!best || (current.score && (!best.score || current.score > best.score))) {
        return current;
      }
      return best;
    }, candidates[0]);

    return {
      runId,
      candidates,
      bestCandidate,
      iterations: config.iterations,
    };
  }

  private async mutatePrompt(
    originalPrompt: string,
    originalSystemPrompt: string | undefined,
    provider: { chat: (request: { messages: LLMMessage[]; model: string; temperature?: number }) => Promise<{ content: string }> },
    config: APEConfig
  ): Promise<APECandidate> {
    const mutationInstructions = `You are an expert prompt engineer. Your task is to improve the following prompt by making targeted mutations.

Original User Prompt:
${originalPrompt}

${originalSystemPrompt ? `Original System Prompt:\n${originalSystemPrompt}\n` : ''}

Evaluation criteria to optimize for:
${config.evaluationCriteria?.join(', ') || 'clarity, specificity, effectiveness'}

Create an improved version of the prompt. Apply one or more of these mutation strategies:
1. Add more specific instructions
2. Include examples (few-shot)
3. Restructure for clarity
4. Add constraints or guardrails
5. Improve the task framing

Respond with ONLY the improved prompt, no explanations.`;

    const response = await provider.chat({
      messages: [{ role: 'user', content: mutationInstructions }],
      model: config.model,
      temperature: config.temperature || 0.7,
    });

    return {
      id: uuidv4(),
      content: response.content,
      systemPrompt: originalSystemPrompt,
      score: undefined,
      metrics: {},
    };
  }

  private async generateNewPrompt(
    originalPrompt: string,
    originalSystemPrompt: string | undefined,
    provider: { chat: (request: { messages: LLMMessage[]; model: string; temperature?: number }) => Promise<{ content: string }> },
    config: APEConfig
  ): Promise<APECandidate> {
    const generationInstructions = `You are an expert prompt engineer. Analyze the intent of the following prompt and generate a completely new prompt that achieves the same goal but with a different approach.

Original User Prompt:
${originalPrompt}

${originalSystemPrompt ? `Original System Prompt:\n${originalSystemPrompt}\n` : ''}

Evaluation criteria to optimize for:
${config.evaluationCriteria?.join(', ') || 'clarity, specificity, effectiveness'}

Create a new prompt that:
1. Achieves the same goal
2. Uses a different structure or approach
3. May include different techniques (chain-of-thought, role-playing, structured output)

Respond with ONLY the new prompt, no explanations.`;

    const response = await provider.chat({
      messages: [{ role: 'user', content: generationInstructions }],
      model: config.model,
      temperature: config.temperature || 0.9,
    });

    return {
      id: uuidv4(),
      content: response.content,
      systemPrompt: originalSystemPrompt,
      score: undefined,
      metrics: {},
    };
  }

  private async refinePrompt(
    originalPrompt: string,
    originalSystemPrompt: string | undefined,
    provider: { chat: (request: { messages: LLMMessage[]; model: string; temperature?: number }) => Promise<{ content: string }> },
    config: APEConfig
  ): Promise<APECandidate> {
    const refinementInstructions = `You are an expert prompt engineer. Your task is to refine and polish the following prompt for maximum effectiveness.

Original User Prompt:
${originalPrompt}

${originalSystemPrompt ? `Original System Prompt:\n${originalSystemPrompt}\n` : ''}

Evaluation criteria to optimize for:
${config.evaluationCriteria?.join(', ') || 'clarity, specificity, effectiveness'}

Refine the prompt by:
1. Fixing any ambiguities
2. Improving word choice for precision
3. Ensuring proper formatting
4. Adding necessary context
5. Removing redundancies

Respond with ONLY the refined prompt, no explanations.`;

    const response = await provider.chat({
      messages: [{ role: 'user', content: refinementInstructions }],
      model: config.model,
      temperature: config.temperature || 0.3,
    });

    return {
      id: uuidv4(),
      content: response.content,
      systemPrompt: originalSystemPrompt,
      score: undefined,
      metrics: {},
    };
  }

  async evaluateCandidate(
    candidate: APECandidate,
    testInputs: string[],
    expectedOutputPatterns: string[],
    provider: ProviderType,
    model: string
  ): Promise<APECandidate> {
    const llmProvider = this.llmAdapter.getProvider(provider);
    let totalScore = 0;
    const metrics: Record<string, number> = {
      coherence: 0,
      relevance: 0,
      completeness: 0,
    };

    for (let i = 0; i < testInputs.length; i++) {
      const messages: LLMMessage[] = [];
      
      if (candidate.systemPrompt) {
        messages.push({ role: 'system', content: candidate.systemPrompt });
      }
      
      // Replace variables in the prompt
      const promptWithInput = candidate.content.replace(/\{\{input\}\}/g, testInputs[i]);
      messages.push({ role: 'user', content: promptWithInput });

      try {
        const response = await llmProvider.chat({
          messages,
          model,
        });

        // Evaluate the response
        const evaluationScore = await this.scoreResponse(
          response.content,
          expectedOutputPatterns[i] || '',
          llmProvider,
          model
        );

        totalScore += evaluationScore;
        metrics.coherence += evaluationScore * 0.4;
        metrics.relevance += evaluationScore * 0.4;
        metrics.completeness += evaluationScore * 0.2;
      } catch (error) {
        console.error('Evaluation failed:', error);
      }
    }

    const avgScore = testInputs.length > 0 ? totalScore / testInputs.length : 0;
    
    return {
      ...candidate,
      score: avgScore,
      metrics: {
        coherence: metrics.coherence / Math.max(testInputs.length, 1),
        relevance: metrics.relevance / Math.max(testInputs.length, 1),
        completeness: metrics.completeness / Math.max(testInputs.length, 1),
      },
    };
  }

  private async scoreResponse(
    response: string,
    expectedPattern: string,
    provider: { chat: (request: { messages: LLMMessage[]; model: string; temperature?: number }) => Promise<{ content: string }> },
    model: string
  ): Promise<number> {
    const scoringPrompt = `Rate the following AI response on a scale of 0-100.

Response:
${response}

${expectedPattern ? `Expected pattern/criteria:\n${expectedPattern}\n` : ''}

Consider:
1. Coherence and clarity
2. Relevance to the likely prompt
3. Completeness and helpfulness

Respond with ONLY a number between 0 and 100.`;

    try {
      const result = await provider.chat({
        messages: [{ role: 'user', content: scoringPrompt }],
        model,
        temperature: 0,
      });

      const score = parseInt(result.content.trim(), 10);
      return isNaN(score) ? 50 : Math.min(100, Math.max(0, score));
    } catch {
      return 50; // Default score on error
    }
  }
}

export default APEEngine;
