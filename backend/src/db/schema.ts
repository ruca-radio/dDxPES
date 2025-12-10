import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Prompt Templates table
export const prompts = sqliteTable('prompts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Prompt Versions table - stores different versions of a prompt
export const promptVersions = sqliteTable('prompt_versions', {
  id: text('id').primaryKey(),
  promptId: text('prompt_id').notNull().references(() => prompts.id),
  version: integer('version').notNull(),
  content: text('content').notNull(),
  systemPrompt: text('system_prompt'),
  variables: text('variables'), // JSON array of variable names
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(false),
});

// Experiments table
export const experiments = sqliteTable('experiments', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  promptVersionId: text('prompt_version_id').notNull().references(() => promptVersions.id),
  provider: text('provider').notNull(), // openai, anthropic, gemini, local
  model: text('model').notNull(),
  parameters: text('parameters'), // JSON for temperature, max_tokens, etc.
  status: text('status').notNull().default('pending'), // pending, running, completed, failed
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// Experiment Results table
export const experimentResults = sqliteTable('experiment_results', {
  id: text('id').primaryKey(),
  experimentId: text('experiment_id').notNull().references(() => experiments.id),
  input: text('input').notNull(), // JSON of input variables
  output: text('output').notNull(),
  latencyMs: integer('latency_ms'),
  tokenCount: integer('token_count'),
  cost: text('cost'), // String to handle decimal precision
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// APE (Automatic Prompt Engineering) Candidates table
export const apeCandidates = sqliteTable('ape_candidates', {
  id: text('id').primaryKey(),
  sourcePromptVersionId: text('source_prompt_version_id').notNull().references(() => promptVersions.id),
  candidateContent: text('candidate_content').notNull(),
  candidateSystemPrompt: text('candidate_system_prompt'),
  score: text('score'), // Evaluation score
  metrics: text('metrics'), // JSON of evaluation metrics
  status: text('status').notNull().default('pending'), // pending, evaluating, accepted, rejected
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// APE Runs table - tracks APE optimization runs
export const apeRuns = sqliteTable('ape_runs', {
  id: text('id').primaryKey(),
  promptVersionId: text('prompt_version_id').notNull().references(() => promptVersions.id),
  strategy: text('strategy').notNull(), // mutation, generation, refinement
  iterations: integer('iterations').notNull().default(1),
  status: text('status').notNull().default('pending'), // pending, running, completed, failed
  config: text('config'), // JSON configuration for the APE run
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});
