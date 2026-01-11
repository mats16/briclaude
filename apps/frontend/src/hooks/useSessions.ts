import { useState, useEffect, useCallback } from 'react';
import type { SessionResponse } from '@repo/types';
import { sessionService } from '@/services/session.service';

interface UseSessionsReturn {
  sessions: SessionResponse[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await sessionService.getSessions();
      setSessions(response.data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load sessions'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    isLoading,
    error,
    refetch: fetchSessions,
  };
}
