import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apeApi, promptsApi, providersApi } from '../api';
import type { APECandidate, PromptVersion } from '../types';
import { Sparkles, Play, CheckCircle, XCircle, Loader, ThumbsUp, ThumbsDown, Clock } from 'lucide-react';

export function APEPage() {
  const queryClient = useQueryClient();
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { data: runs, isLoading } = useQuery({
    queryKey: ['ape-runs'],
    queryFn: apeApi.listRuns,
  });

  const { data: runDetail } = useQuery({
    queryKey: ['ape-run', selectedRun],
    queryFn: () => selectedRun ? apeApi.getRun(selectedRun) : null,
    enabled: !!selectedRun,
    refetchInterval: (query) => {
      const run = query.state.data;
      return run?.status === 'running' ? 3000 : false;
    },
  });

  // Prefetch candidates list for better UX
  useQuery({
    queryKey: ['ape-candidates'],
    queryFn: apeApi.listCandidates,
  });

  const acceptMutation = useMutation({
    mutationFn: apeApi.acceptCandidate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ape-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['ape-run', selectedRun] });
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: apeApi.rejectCandidate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ape-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['ape-run', selectedRun] });
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

  const getCandidateStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <span className="badge success">Accepted</span>;
      case 'rejected':
        return <span className="badge error">Rejected</span>;
      case 'evaluating':
        return <span className="badge warning">Evaluating</span>;
      default:
        return <span className="badge">Pending</span>;
    }
  };

  if (isLoading) {
    return <div className="loading">Loading APE runs...</div>;
  }

  return (
    <div className="page ape-page">
      <div className="page-header">
        <h2>
          <Sparkles size={24} /> Automatic Prompt Engineering
        </h2>
        <button className="btn btn-primary" onClick={() => setIsStarting(true)}>
          <Play size={16} /> Start APE Run
        </button>
      </div>

      <div className="ape-layout">
        <div className="ape-runs-list">
          <h3>APE Runs</h3>
          {runs?.map((run) => (
            <div
              key={run.id}
              className={`ape-run-card ${selectedRun === run.id ? 'selected' : ''}`}
              onClick={() => setSelectedRun(run.id)}
            >
              <div className="run-header">
                {getStatusIcon(run.status)}
                <span className="strategy-badge">{run.strategy}</span>
              </div>
              <p>{run.iterations} iterations</p>
              <div className="run-meta">
                <Clock size={14} />
                <span>{new Date(run.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
          {runs?.length === 0 && (
            <div className="empty-state">
              <p>No APE runs yet. Start your first optimization!</p>
            </div>
          )}
        </div>

        <div className="ape-detail">
          {runDetail ? (
            <>
              <div className="detail-header">
                <h3>APE Run - {runDetail.strategy}</h3>
                <span className={`status-badge ${runDetail.status}`}>{runDetail.status}</span>
              </div>

              <div className="run-info">
                <div className="info-grid">
                  <div className="info-item">
                    <label>Strategy</label>
                    <span>{runDetail.strategy}</span>
                  </div>
                  <div className="info-item">
                    <label>Iterations</label>
                    <span>{runDetail.iterations}</span>
                  </div>
                  <div className="info-item">
                    <label>Created</label>
                    <span>{new Date(runDetail.createdAt).toLocaleString()}</span>
                  </div>
                  {runDetail.completedAt && (
                    <div className="info-item">
                      <label>Completed</label>
                      <span>{new Date(runDetail.completedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="candidates-section">
                <h4>Generated Candidates ({runDetail.candidates?.length || 0})</h4>
                <div className="candidates-list">
                  {runDetail.candidates?.map((candidate: APECandidate) => (
                    <div key={candidate.id} className="candidate-card">
                      <div className="candidate-header">
                        {getCandidateStatusBadge(candidate.status)}
                        {candidate.score && (
                          <span className="score">Score: {parseFloat(candidate.score).toFixed(1)}</span>
                        )}
                      </div>
                      <div className="candidate-content">
                        <pre>{candidate.candidateContent}</pre>
                      </div>
                      {candidate.candidateSystemPrompt && (
                        <div className="candidate-system">
                          <strong>System:</strong>
                          <pre>{candidate.candidateSystemPrompt}</pre>
                        </div>
                      )}
                      {candidate.status === 'pending' && (
                        <div className="candidate-actions">
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => acceptMutation.mutate(candidate.id)}
                            disabled={acceptMutation.isPending}
                          >
                            <ThumbsUp size={14} /> Accept
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => rejectMutation.mutate(candidate.id)}
                            disabled={rejectMutation.isPending}
                          >
                            <ThumbsDown size={14} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Sparkles size={48} />
              <h3>Automatic Prompt Engineering</h3>
              <p>Select an APE run to view candidates, or start a new optimization run.</p>
            </div>
          )}
        </div>
      </div>

      {isStarting && (
        <Modal onClose={() => setIsStarting(false)}>
          <StartAPEForm
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['ape-runs'] });
              setIsStarting(false);
            }}
            onCancel={() => setIsStarting(false)}
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

function StartAPEForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [promptVersionId, setPromptVersionId] = useState('');
  const [strategy, setStrategy] = useState<'mutation' | 'generation' | 'refinement'>('mutation');
  const [iterations, setIterations] = useState(5);
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o-mini');

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

  const startMutation = useMutation({
    mutationFn: apeApi.startRun,
    onSuccess,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startMutation.mutate({
      promptVersionId,
      strategy,
      iterations,
      provider,
      model,
    });
  };

  const selectedProviderModels = providers?.find((p) => p.type === provider)?.models || [];

  return (
    <form onSubmit={handleSubmit} className="form">
      <h3>
        <Sparkles size={20} /> Start APE Run
      </h3>
      <p className="form-subtitle">
        Automatically generate and evaluate prompt variations.
      </p>
      
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

      <div className="form-group">
        <label>Strategy</label>
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value as 'mutation' | 'generation' | 'refinement')}
        >
          <option value="mutation">Mutation - Targeted improvements</option>
          <option value="generation">Generation - New approaches</option>
          <option value="refinement">Refinement - Polish & optimize</option>
        </select>
      </div>

      <div className="form-group">
        <label>Iterations: {iterations}</label>
        <input
          type="range"
          min="1"
          max="20"
          value={iterations}
          onChange={(e) => setIterations(parseInt(e.target.value))}
        />
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

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={startMutation.isPending}>
          <Sparkles size={16} /> {startMutation.isPending ? 'Starting...' : 'Start APE Run'}
        </button>
      </div>
    </form>
  );
}
