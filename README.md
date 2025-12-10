# dDxPES - Prompt Lab

A modern prompt engineering system / automated prompt improvement system designed to maximize LLM output quality and alignment.

## Features

- **Prompt Templates & Versioning**: Create, edit, and version prompt templates with variable support
- **Experiments**: Run experiments with different LLM providers and models, compare results
- **APE (Automatic Prompt Engineering)**: Automatically generate and evaluate prompt variations using mutation, generation, and refinement strategies
- **Provider-Agnostic LLM Adapter**: Support for OpenAI, Anthropic, Gemini, and local LLMs (Ollama, LM Studio)
- **SQLite Database**: Persistent storage for prompts, versions, experiments, and APE candidates

## Project Structure

```
├── backend/              # Node.js/TypeScript API server
│   ├── src/
│   │   ├── api/         # Express routes (prompts, experiments, APE, providers)
│   │   ├── ape/         # Automatic Prompt Engineering engine
│   │   ├── db/          # SQLite database with Drizzle ORM
│   │   └── llm/         # Provider-agnostic LLM adapters
│   └── package.json
│
├── frontend/             # React/TypeScript frontend
│   ├── src/
│   │   ├── api/         # API client
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components (Prompts, Experiments, APE, Settings)
│   │   └── types/       # TypeScript types
│   └── package.json
│
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your API keys
# OPENAI_API_KEY=your-key
# ANTHROPIC_API_KEY=your-key
# GEMINI_API_KEY=your-key

# Run in development mode
npm run dev

# Or build and run
npm run build
npm start
```

The API server will start at `http://localhost:3001`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run in development mode
npm run dev

# Or build for production
npm run build
npm run preview
```

The frontend will be available at `http://localhost:5173`

## API Endpoints

### Prompts
- `GET /api/prompts` - List all prompts
- `GET /api/prompts/:id` - Get prompt with versions
- `POST /api/prompts` - Create new prompt
- `PATCH /api/prompts/:id` - Update prompt metadata
- `DELETE /api/prompts/:id` - Delete prompt
- `POST /api/prompts/:id/versions` - Create new version

### Experiments
- `GET /api/experiments` - List all experiments
- `GET /api/experiments/:id` - Get experiment with results
- `POST /api/experiments` - Create new experiment
- `POST /api/experiments/:id/run` - Run experiment with inputs
- `DELETE /api/experiments/:id` - Delete experiment

### APE (Automatic Prompt Engineering)
- `GET /api/ape/runs` - List APE runs
- `GET /api/ape/runs/:id` - Get APE run with candidates
- `POST /api/ape/runs` - Start new APE run
- `GET /api/ape/candidates` - List all candidates
- `POST /api/ape/candidates/:id/evaluate` - Evaluate candidate
- `POST /api/ape/candidates/:id/accept` - Accept candidate (creates new version)
- `POST /api/ape/candidates/:id/reject` - Reject candidate

### Providers
- `GET /api/providers` - List available providers and models
- `GET /api/providers/:provider/models` - Get models for provider
- `POST /api/providers/:provider/test` - Test provider connection

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | API server port (default: 3001) |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `LOCAL_LLM_URL` | Local LLM endpoint (default: http://localhost:11434/v1) |
| `DATABASE_PATH` | SQLite database path (default: ./data/prompt-lab.db) |

## Technology Stack

### Backend
- Node.js + TypeScript
- Express.js
- Drizzle ORM + SQLite
- Zod (validation)

### Frontend
- React 19 + TypeScript
- Vite
- TanStack Query (React Query)
- React Router
- Lucide Icons

## License

MIT 
