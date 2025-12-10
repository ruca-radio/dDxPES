import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { providersApi } from '../api';
import { CheckCircle, XCircle, Loader, Settings, Zap } from 'lucide-react';

export function SettingsPage() {
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    provider: string;
    success: boolean;
    message: string;
  } | null>(null);

  const { data: providers, isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: providersApi.list,
  });

  const testMutation = useMutation({
    mutationFn: ({ provider, model }: { provider: string; model: string }) =>
      providersApi.test(provider, model),
    onSuccess: (data, variables) => {
      setTestResult({
        provider: variables.provider,
        success: data.success,
        message: data.success
          ? `Response: "${data.response}" (${data.latencyMs}ms)`
          : `Error: ${data.error}`,
      });
      setTestingProvider(null);
    },
    onError: (error, variables) => {
      setTestResult({
        provider: variables.provider,
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      setTestingProvider(null);
    },
  });

  const handleTest = (provider: string, model: string) => {
    setTestingProvider(provider);
    setTestResult(null);
    testMutation.mutate({ provider, model });
  };

  if (isLoading) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <div className="page settings-page">
      <div className="page-header">
        <h2>
          <Settings size={24} /> Settings
        </h2>
      </div>

      <div className="settings-content">
        <section className="settings-section">
          <h3>
            <Zap size={20} /> LLM Providers
          </h3>
          <p className="section-description">
            Configure and test your LLM provider connections. API keys should be set in the backend
            environment variables.
          </p>

          <div className="providers-grid">
            {providers?.map((provider) => (
              <div key={provider.type} className="provider-card">
                <div className="provider-header">
                  <h4>{provider.type}</h4>
                  {testResult?.provider === provider.type && (
                    <span className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                      {testResult.success ? (
                        <CheckCircle size={16} />
                      ) : (
                        <XCircle size={16} />
                      )}
                    </span>
                  )}
                </div>

                <div className="provider-models">
                  <label>Available Models:</label>
                  <ul>
                    {provider.models.map((model) => (
                      <li key={model}>{model}</li>
                    ))}
                  </ul>
                </div>

                <button
                  className="btn btn-secondary"
                  onClick={() => handleTest(provider.type, provider.models[0])}
                  disabled={testingProvider === provider.type}
                >
                  {testingProvider === provider.type ? (
                    <>
                      <Loader size={16} className="spinning" /> Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </button>

                {testResult?.provider === provider.type && (
                  <div className={`test-message ${testResult.success ? 'success' : 'error'}`}>
                    {testResult.message}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3>Environment Variables</h3>
          <p className="section-description">
            Set these environment variables in the backend to configure providers:
          </p>
          <div className="env-vars">
            <code>OPENAI_API_KEY=your-openai-key</code>
            <code>ANTHROPIC_API_KEY=your-anthropic-key</code>
            <code>GEMINI_API_KEY=your-gemini-key</code>
            <code>LOCAL_LLM_URL=http://localhost:11434/v1</code>
          </div>
        </section>

        <section className="settings-section">
          <h3>About Prompt Lab</h3>
          <p>
            Prompt Lab is a prompt engineering and experiment management system that helps you:
          </p>
          <ul className="features-list">
            <li>✨ Create and version prompt templates</li>
            <li>🧪 Run experiments with different LLM providers</li>
            <li>🤖 Use Automatic Prompt Engineering (APE) to optimize prompts</li>
            <li>📊 Compare and analyze results</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
