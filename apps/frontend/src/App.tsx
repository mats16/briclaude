import { useState, useEffect } from 'react';
import type { HealthCheckResponse } from '@repo/types';

function App() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealth(data);
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-[400px] border rounded-lg shadow-sm bg-card text-card-foreground">
        <div className="p-6">
          <h2 className="text-2xl font-semibold">Claude Code on Databricks</h2>
          <p className="text-sm text-muted-foreground mt-2">React + Fastify Monorepo</p>
        </div>
        <div className="p-6 pt-0 space-y-4">
          {health && (
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">Status: {health.status}</p>
              <p className="text-sm text-muted-foreground">Service: {health.service}</p>
              <p className="text-sm text-muted-foreground">
                Time: {new Date(health.timestamp).toLocaleString()}
              </p>
            </div>
          )}
          <button
            onClick={checkHealth}
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Check Health'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
