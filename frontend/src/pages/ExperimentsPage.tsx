import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { experimentsApi, promptsApi, providersApi } from '../api';
import type { PromptVersion } from '../types';
import { Plus, Play, Trash2, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';

export function ExperimentsPage() {
  const queryClient = useQueryClient();
  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const { data: experiments, isLoading } = useQuery({
    queryKey: ['experiments'],
    queryFn: experimentsApi.list,
  });

  const { data: experimentDetail } = useQuery({
    queryKey: ['experiment', selectedExperiment],
    queryFn: () => selectedExperiment ? experimentsApi.get(selectedExperiment) : null,
    enabled: !!selectedExperiment,
    refetchInterval: (query) => {
      const exp = query.state.data;
      return exp?.status === 'running' ? 2000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: experimentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
      setSelectedExperiment(null);
    },
  });

  const runMutation = useMutation({
    mutationFn: ({ id, inputs }: { id: string; inputs: Record<string, string>[] }) =>
      experimentsApi.run(id, inputs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiment', selectedExperiment] });
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
      setIsRunning(false);
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="status-icon success" size={16} />;
      case 'failed':
        return <XCircle className="status-icon error" size={16} />;
      case 'running':
        return <Loader className="status-icon running" size={16} />;
      default:
        return <Clock className="status-icon pending" size={16} />;
    }
  };

  if (isLoading) {
    return <div className="loading">Loading experiments...</div>;
  }

  return (
    <div className="page experiments-page">
      <div className="page-header">
        <h2>Experiments</h2>
        <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
          <Plus size={16} /> New Experiment
        </button>
      </div>

      <div className="experiments-layout">
        <div className="experiments-list">
          {experiments?.map((exp) => (
            <div
              key={exp.id}
              className={`experiment-card ${selectedExperiment === exp.id ? 'selected' : ''}`}
              onClick={() => setSelectedExperiment(exp.id)}
            >
              <div className="experiment-header">
                {getStatusIcon(exp.status)}
                <h3>{exp.name}</h3>
              </div>
              <p>{exp.description || 'No description'}</p>
              <div className="experiment-meta">
                <span className="provider-badge">{exp.provider}</span>
                <span className="model-badge">{exp.model}</span>
              </div>
            </div>
          ))}
          {experiments?.length === 0 && (
            <div className="empty-state">
              <p>No experiments yet. Create your first experiment!</p>
            </div>
          )}
        </div>

        <div className="experiment-detail">
          {experimentDetail ? (
            <>
              <div className="detail-header">
                <div>
                  <h3>{experimentDetail.name}</h3>
                  <p className="status-text">
                    Status: <strong>{experimentDetail.status}</strong>
                  </p>
                </div>
                <div className="detail-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => setIsRunning(true)}
                    disabled={experimentDetail.status === 'running'}
                  >
                    <Play size={16} /> Run
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => deleteMutation.mutate(experimentDetail.id)}
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              </div>

              <div className="experiment-info">
                <div className="info-grid">
                  <div className="info-item">
                    <label>Provider</label>
                    <span>{experimentDetail.provider}</span>
                  </div>
                  <div className="info-item">
                    <label>Model</label>
                    <span>{experimentDetail.model}</span>
                  </div>
                  <div className="info-item">
                    <label>Created</label>
                    <span>{new Date(experimentDetail.createdAt).toLocaleString()}</span>
                  </div>
                  {experimentDetail.completedAt && (
                    <div className="info-item">
                      <label>Completed</label>
                      <span>{new Date(experimentDetail.completedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {experimentDetail.results && experimentDetail.results.length > 0 && (
                <div className="results-section">
                  <h4>Results ({experimentDetail.results.length})</h4>
                  <div className="results-list">
                    {experimentDetail.results.map((result) => (
                      <div key={result.id} className="result-card">
                        <div className="result-input">
                          <strong>Input:</strong>
                          <pre>{result.input}</pre>
                        </div>
                        <div className="result-output">
                          <strong>Output:</strong>
                          <pre>{result.output}</pre>
                        </div>
                        <div className="result-meta">
                          {result.latencyMs && <span>⏱️ {result.latencyMs}ms</span>}
                          {result.tokenCount && <span>📝 {result.tokenCount} tokens</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <p>Select an experiment to view details</p>
            </div>
          )}
        </div>
      </div>

      {isCreating && (
        <Modal onClose={() => setIsCreating(false)}>
          <CreateExperimentForm
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['experiments'] });
              setIsCreating(false);
            }}
            onCancel={() => setIsCreating(false)}
          />
        </Modal>
      )}

      {isRunning && experimentDetail && (
        <Modal onClose={() => setIsRunning(false)}>
          <RunExperimentForm
            onSubmit={(inputs) => runMutation.mutate({ id: experimentDetail.id, inputs })}
            onCancel={() => setIsRunning(false)}
            isLoading={runMutation.isPending}
          />
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function CreateExperimentForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [promptVersionId, setPromptVersionId] = useState('');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.7);

  const { data: prompts } = useQuery({
    queryKey: ['prompts'],
    queryFn: promptsApi.list,
  });

  const { data: promptDetail } = useQuery({
    queryKey: ['prompt', prompts?.[0]?.id],
    queryFn: () => prompts?.[0]?.id ? promptsApi.get(prompts[0].id) : null,
    enabled: !!prompts?.[0]?.id,
  });

  const { data: providers } = useQuery({
    queryKey: ['providers'],
    queryFn: providersApi.list,
  });

  const createMutation = useMutation({
    mutationFn: experimentsApi.create,
    onSuccess,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      description: description || undefined,
      promptVersionId,
      provider,
      model,
      parameters: { temperature },
    });
  };

  const selectedProviderModels = providers?.find((p) => p.type === provider)?.models || [];

  return (
    <form onSubmit={handleSubmit} className="form">
      <h3>Create New Experiment</h3>
      <div className="form-group">
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="My Experiment"
        />
      </div>
      <div className="form-group">
        <label>Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>
      <div className="form-group">
        <label>Prompt Version</label>
        <select
          value={promptVersionId}
          onChange={(e) => setPromptVersionId(e.target.value)}
          required
        >
          <option value="">Select a prompt version</option>
          {promptDetail?.versions?.map((v: PromptVersion) => (
            <option key={v.id} value={v.id}>
              v{v.version} - {new Date(v.createdAt).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Provider</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            {providers?.map((p) => (
              <option key={p.type} value={p.type}>
                {p.type}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Model</label>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {selectedProviderModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Temperature: {temperature}</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
        />
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creating...' : 'Create Experiment'}
        </button>
      </div>
    </form>
  );
}

function RunExperimentForm({
  onSubmit,
  onCancel,
  isLoading,
}: {
  onSubmit: (inputs: Record<string, string>[]) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [inputsJson, setInputsJson] = useState('[\n  { "input": "Hello, world!" }\n]');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const inputs = JSON.parse(inputsJson);
      if (!Array.isArray(inputs)) {
        setError('Inputs must be an array');
        return;
      }
      setError(null);
      onSubmit(inputs);
    } catch {
      setError('Invalid JSON format');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <h3>Run Experiment</h3>
      <p className="form-subtitle">Enter test inputs as a JSON array of objects.</p>
      <div className="form-group">
        <label>Test Inputs (JSON)</label>
        <textarea
          value={inputsJson}
          onChange={(e) => setInputsJson(e.target.value)}
          rows={8}
          className="code"
          placeholder='[{ "variable1": "value1" }]'
        />
        {error && <span className="error-text">{error}</span>}
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          <Play size={16} /> {isLoading ? 'Running...' : 'Run Experiment'}
        </button>
      </div>
    </form>
  );
}
