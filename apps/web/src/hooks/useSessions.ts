import { useState, useEffect, useCallback } from 'react';
import type { SessionResponse } from '@repo/types';
import { sessionService } from '@/services/session.service';

interface UseSessionsReturn {
  sessions: SessionResponse[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateSession: (updatedSession: SessionResponse) => void;
  getSession: (sessionId: string) => SessionResponse | undefined;
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

  const updateSession = useCallback((updatedSession: SessionResponse) => {
    setSessions(prevSessions =>
      prevSessions.map(s => (s.id === updatedSession.id ? updatedSession : s))
    );
  }, []);

  const getSession = useCallback(
    (sessionId: string) => sessions.find(s => s.id === sessionId),
    [sessions]
  );

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    isLoading,
    error,
    refetch: fetchSessions,
    updateSession,
    getSession,
  };
}
