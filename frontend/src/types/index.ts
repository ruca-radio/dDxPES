export interface Prompt {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  versions?: PromptVersion[];
}

export interface PromptVersion {
  id: string;
  promptId: string;
  version: number;
  content: string;
  systemPrompt?: string;
  variables?: string;
  createdAt: string;
  isActive?: boolean;
}

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  promptVersionId: string;
  provider: ProviderType;
  model: string;
  parameters?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  results?: ExperimentResult[];
}

export interface ExperimentResult {
  id: string;
  experimentId: string;
  input: string;
  output: string;
  latencyMs?: number;
  tokenCount?: number;
  cost?: string;
  createdAt: string;
}

export interface APECandidate {
  id: string;
  sourcePromptVersionId: string;
  candidateContent: string;
  candidateSystemPrompt?: string;
  score?: string;
  metrics?: string;
  status: 'pending' | 'evaluating' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface APERun {
  id: string;
  promptVersionId: string;
  strategy: 'mutation' | 'generation' | 'refinement';
  iterations: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config?: string;
  createdAt: string;
  completedAt?: string;
  candidates?: APECandidate[];
}

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'local';

export interface ProviderInfo {
  type: ProviderType;
  models: string[];
}
