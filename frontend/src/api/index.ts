import axios from 'axios';
import type { Prompt, PromptVersion, Experiment, APERun, APECandidate, ProviderInfo } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Prompts API
export const promptsApi = {
  list: () => api.get<Prompt[]>('/prompts').then((res) => res.data),
  
  get: (id: string) => api.get<Prompt & { versions: PromptVersion[] }>(`/prompts/${id}`).then((res) => res.data),
  
  create: (data: { name: string; description?: string; content: string; systemPrompt?: string; variables?: string[] }) =>
    api.post<Prompt>('/prompts', data).then((res) => res.data),
  
  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch<Prompt>(`/prompts/${id}`, data).then((res) => res.data),
  
  delete: (id: string) => api.delete(`/prompts/${id}`),
  
  createVersion: (id: string, data: { content: string; systemPrompt?: string; variables?: string[] }) =>
    api.post<PromptVersion>(`/prompts/${id}/versions`, data).then((res) => res.data),
  
  activateVersion: (promptId: string, versionId: string) =>
    api.post<PromptVersion>(`/prompts/${promptId}/versions/${versionId}/activate`).then((res) => res.data),
};

// Experiments API
export const experimentsApi = {
  list: () => api.get<Experiment[]>('/experiments').then((res) => res.data),
  
  get: (id: string) => api.get<Experiment>(`/experiments/${id}`).then((res) => res.data),
  
  create: (data: {
    name: string;
    description?: string;
    promptVersionId: string;
    provider: string;
    model: string;
    parameters?: { temperature?: number; maxTokens?: number; topP?: number };
  }) => api.post<Experiment>('/experiments', data).then((res) => res.data),
  
  run: (id: string, inputs: Record<string, string>[]) =>
    api.post<{ experimentId: string; results: Array<{ id: string; input: Record<string, string>; output?: string; error?: string }> }>(
      `/experiments/${id}/run`,
      { inputs }
    ).then((res) => res.data),
  
  delete: (id: string) => api.delete(`/experiments/${id}`),
};

// APE API
export const apeApi = {
  listRuns: () => api.get<APERun[]>('/ape/runs').then((res) => res.data),
  
  getRun: (id: string) => api.get<APERun & { candidates: APECandidate[] }>(`/ape/runs/${id}`).then((res) => res.data),
  
  startRun: (data: {
    promptVersionId: string;
    strategy: 'mutation' | 'generation' | 'refinement';
    iterations: number;
    provider: string;
    model: string;
    evaluationCriteria?: string[];
    temperature?: number;
  }) => api.post<APERun>('/ape/runs', data).then((res) => res.data),
  
  listCandidates: () => api.get<APECandidate[]>('/ape/candidates').then((res) => res.data),
  
  getCandidate: (id: string) => api.get<APECandidate>(`/ape/candidates/${id}`).then((res) => res.data),
  
  evaluateCandidate: (id: string, data: { testInputs: string[]; expectedPatterns?: string[]; provider: string; model: string }) =>
    api.post<{ id: string; score: number; metrics: Record<string, number> }>(`/ape/candidates/${id}/evaluate`, data).then((res) => res.data),
  
  acceptCandidate: (id: string) =>
    api.post<{ message: string; newVersionId: string; version: number }>(`/ape/candidates/${id}/accept`).then((res) => res.data),
  
  rejectCandidate: (id: string) => api.post(`/ape/candidates/${id}/reject`),
};

// Providers API
export const providersApi = {
  list: () => api.get<ProviderInfo[]>('/providers').then((res) => res.data),
  
  getModels: (provider: string) => api.get<string[]>(`/providers/${provider}/models`).then((res) => res.data),
  
  test: (provider: string, model: string) =>
    api.post<{ success: boolean; response?: string; error?: string; latencyMs?: number }>(
      `/providers/${provider}/test`,
      { model }
    ).then((res) => res.data),
};

export default api;
