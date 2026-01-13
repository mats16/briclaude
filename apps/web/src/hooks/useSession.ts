import { useState, useEffect, useCallback } from 'react';
import type { SessionResponse, SessionUpdateRequest } from '@repo/types';
import { sessionService } from '@/services/session.service';

interface UseSessionOptions {
  sessionId: string | null;
}

interface UseSessionReturn {
  session: SessionResponse | null;
  isLoading: boolean;
  error: Error | null;
  updateSession: (request: SessionUpdateRequest) => Promise<SessionResponse | null>;
  refetch: () => Promise<void>;
}

export function useSession({ sessionId }: UseSessionOptions): UseSessionReturn {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await sessionService.getSession(sessionId);
      setSession(response);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch session'));
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const updateSession = useCallback(
    async (request: SessionUpdateRequest): Promise<SessionResponse | null> => {
      if (!sessionId) {
        return null;
      }

      try {
        const response = await sessionService.updateSession(sessionId, request);
        setSession(response);
        return response;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to update session'));
        return null;
      }
    },
    [sessionId]
  );

  return {
    session,
    isLoading,
    error,
    updateSession,
    refetch: fetchSession,
  };
}
