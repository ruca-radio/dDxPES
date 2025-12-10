import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promptsApi } from '../api';
import type { Prompt, PromptVersion } from '../types';
import { Plus, Edit2, Trash2, Copy, Check, Clock } from 'lucide-react';

export function PromptsPage() {
  const queryClient = useQueryClient();
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const { data: prompts, isLoading } = useQuery({
    queryKey: ['prompts'],
    queryFn: promptsApi.list,
  });

  const { data: promptDetail } = useQuery({
    queryKey: ['prompt', selectedPrompt],
    queryFn: () => selectedPrompt ? promptsApi.get(selectedPrompt) : null,
    enabled: !!selectedPrompt,
  });

  const createMutation = useMutation({
    mutationFn: promptsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      setIsCreating(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: promptsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      setSelectedPrompt(null);
    },
  });

  const createVersionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { content: string; systemPrompt?: string } }) =>
      promptsApi.createVersion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt', selectedPrompt] });
      setIsEditing(false);
    },
  });

  if (isLoading) {
    return <div className="loading">Loading prompts...</div>;
  }

  return (
    <div className="page prompts-page">
      <div className="page-header">
        <h2>Prompt Templates</h2>
        <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
          <Plus size={16} /> New Prompt
        </button>
      </div>

      <div className="prompts-layout">
        <div className="prompts-list">
          {prompts?.map((prompt) => (
            <div
              key={prompt.id}
              className={`prompt-card ${selectedPrompt === prompt.id ? 'selected' : ''}`}
              onClick={() => setSelectedPrompt(prompt.id)}
            >
              <h3>{prompt.name}</h3>
              <p>{prompt.description || 'No description'}</p>
              <div className="prompt-meta">
                <Clock size={14} />
                <span>{new Date(prompt.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {prompts?.length === 0 && (
            <div className="empty-state">
              <p>No prompts yet. Create your first prompt template!</p>
            </div>
          )}
        </div>

        <div className="prompt-detail">
          {promptDetail ? (
            <>
              <div className="detail-header">
                <h3>{promptDetail.name}</h3>
                <div className="detail-actions">
                  <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                    <Edit2 size={16} /> New Version
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => deleteMutation.mutate(promptDetail.id)}
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              </div>

              <div className="versions-list">
                <h4>Versions</h4>
                {promptDetail.versions?.map((version: PromptVersion) => (
                  <div key={version.id} className={`version-card ${version.isActive ? 'active' : ''}`}>
                    <div className="version-header">
                      <span className="version-number">v{version.version}</span>
                      {version.isActive && <span className="badge">Active</span>}
                      <span className="version-date">
                        {new Date(version.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {version.systemPrompt && (
                      <div className="version-system">
                        <strong>System:</strong>
                        <pre>{version.systemPrompt}</pre>
                      </div>
                    )}
                    <div className="version-content">
                      <strong>Content:</strong>
                      <pre>{version.content}</pre>
                    </div>
                    <button
                      className="btn btn-sm"
                      onClick={() => navigator.clipboard.writeText(version.content)}
                    >
                      <Copy size={14} /> Copy
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>Select a prompt to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Prompt Modal */}
      {isCreating && (
        <Modal onClose={() => setIsCreating(false)}>
          <CreatePromptForm
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setIsCreating(false)}
            isLoading={createMutation.isPending}
          />
        </Modal>
      )}

      {/* Edit/New Version Modal */}
      {isEditing && promptDetail && (
        <Modal onClose={() => setIsEditing(false)}>
          <EditPromptForm
            prompt={promptDetail}
            onSubmit={(data) => createVersionMutation.mutate({ id: promptDetail.id, data })}
            onCancel={() => setIsEditing(false)}
            isLoading={createVersionMutation.isPending}
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

function CreatePromptForm({
  onSubmit,
  onCancel,
  isLoading,
}: {
  onSubmit: (data: { name: string; description?: string; content: string; systemPrompt?: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, description: description || undefined, content, systemPrompt: systemPrompt || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <h3>Create New Prompt</h3>
      <div className="form-group">
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="My Prompt Template"
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
        <label>System Prompt (Optional)</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={3}
          placeholder="You are a helpful assistant..."
        />
      </div>
      <div className="form-group">
        <label>Prompt Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={6}
          placeholder="Enter your prompt template here. Use {{variable}} for variables."
        />
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Prompt'}
        </button>
      </div>
    </form>
  );
}

function EditPromptForm({
  prompt,
  onSubmit,
  onCancel,
  isLoading,
}: {
  prompt: Prompt & { versions: PromptVersion[] };
  onSubmit: (data: { content: string; systemPrompt?: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const latestVersion = prompt.versions?.[0];
  const [content, setContent] = useState(latestVersion?.content || '');
  const [systemPrompt, setSystemPrompt] = useState(latestVersion?.systemPrompt || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ content, systemPrompt: systemPrompt || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <h3>Create New Version</h3>
      <p className="form-subtitle">Creating version {(latestVersion?.version || 0) + 1} for "{prompt.name}"</p>
      <div className="form-group">
        <label>System Prompt (Optional)</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={3}
          placeholder="You are a helpful assistant..."
        />
      </div>
      <div className="form-group">
        <label>Prompt Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={8}
          placeholder="Enter your prompt template here. Use {{variable}} for variables."
        />
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          <Check size={16} /> {isLoading ? 'Saving...' : 'Save Version'}
        </button>
      </div>
    </form>
  );
}
