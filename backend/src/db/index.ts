import Database, { Database as DatabaseType } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/prompt-lab.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite: DatabaseType = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

// Initialize database tables
export function initializeDatabase(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL REFERENCES prompts(id),
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      system_prompt TEXT,
      variables TEXT,
      created_at INTEGER NOT NULL,
      is_active INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      prompt_version_id TEXT NOT NULL REFERENCES prompt_versions(id),
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      parameters TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS experiment_results (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL REFERENCES experiments(id),
      input TEXT NOT NULL,
      output TEXT NOT NULL,
      latency_ms INTEGER,
      token_count INTEGER,
      cost TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ape_candidates (
      id TEXT PRIMARY KEY,
      source_prompt_version_id TEXT NOT NULL REFERENCES prompt_versions(id),
      candidate_content TEXT NOT NULL,
      candidate_system_prompt TEXT,
      score TEXT,
      metrics TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ape_runs (
      id TEXT PRIMARY KEY,
      prompt_version_id TEXT NOT NULL REFERENCES prompt_versions(id),
      strategy TEXT NOT NULL,
      iterations INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      config TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
    CREATE INDEX IF NOT EXISTS idx_experiments_prompt_version_id ON experiments(prompt_version_id);
    CREATE INDEX IF NOT EXISTS idx_experiment_results_experiment_id ON experiment_results(experiment_id);
    CREATE INDEX IF NOT EXISTS idx_ape_candidates_source ON ape_candidates(source_prompt_version_id);
    CREATE INDEX IF NOT EXISTS idx_ape_runs_prompt_version_id ON ape_runs(prompt_version_id);
  `);
}

export { sqlite };
