import { LLMProvider, ProviderConfig, ProviderType } from './types';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { LocalProvider } from './local';

export class LLMAdapter {
  private providers: Map<ProviderType, LLMProvider> = new Map();

  constructor(configs?: Partial<Record<ProviderType, ProviderConfig>>) {
    // Initialize providers with configs
    this.providers.set('openai', new OpenAIProvider(configs?.openai || {}));
    this.providers.set('anthropic', new AnthropicProvider(configs?.anthropic || {}));
    this.providers.set('gemini', new GeminiProvider(configs?.gemini || {}));
    this.providers.set('local', new LocalProvider(configs?.local || {}));
  }

  getProvider(type: ProviderType): LLMProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Unknown provider type: ${type}`);
    }
    return provider;
  }

  async listProviders(): Promise<{ type: ProviderType; models: string[] }[]> {
    const results: { type: ProviderType; models: string[] }[] = [];
    
    for (const [type, provider] of this.providers) {
      try {
        const models = await provider.listModels();
        results.push({ type, models });
      } catch (error) {
        console.error(`Failed to list models for ${type}:`, error);
        results.push({ type, models: [] });
      }
    }
    
    return results;
  }
}

export * from './types';
export { OpenAIProvider } from './openai';
export { AnthropicProvider } from './anthropic';
export { GeminiProvider } from './gemini';
export { LocalProvider } from './local';
