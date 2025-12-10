import { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from './types';

// Default URL for local LLM endpoints (Ollama, LM Studio, etc.)
const DEFAULT_LOCAL_LLM_URL = 'http://localhost:11434/v1';

interface LocalLLMResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface LocalModelsResponse {
  data?: Array<{ id: string }>;
}

export class LocalProvider implements LLMProvider {
  name = 'local';
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.baseUrl = config.baseUrl || process.env.LOCAL_LLM_URL || DEFAULT_LOCAL_LLM_URL;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    // Use OpenAI-compatible API format (supported by Ollama, LM Studio, etc.)
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        top_p: request.topP,
        frequency_penalty: request.frequencyPenalty,
        presence_penalty: request.presencePenalty,
        stop: request.stop,
      }),
    });

    const latencyMs = Date.now() - startTime;
    const data = await response.json() as LocalLLMResponse;

    if (!response.ok) {
      throw new Error(`Local LLM API error: ${JSON.stringify(data)}`);
    }

    return {
      content: data.choices?.[0]?.message?.content || '',
      finishReason: data.choices?.[0]?.finish_reason,
      tokenUsage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      latencyMs,
    };
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`);
      if (!response.ok) {
        return ['llama3', 'mistral', 'codellama'];
      }
      const data = await response.json() as LocalModelsResponse;
      return data.data?.map((m) => m.id) || ['llama3', 'mistral', 'codellama'];
    } catch {
      // Return common local models if API is unavailable
      return ['llama3', 'mistral', 'codellama'];
    }
  }
}
