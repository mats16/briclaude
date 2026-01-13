import { createContext, useCallback, useEffect, useState, useMemo, type ReactNode } from 'react';
import type { UserInfo, TokenInfo } from '@repo/types';
import { userService } from '@/services';

export interface UserContextValue {
  user: UserInfo | null;
  databricksHost: string | null;
  tokens: TokenInfo[];
  /** Databricks PAT が設定されているかどうか */
  hasPat: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const UserContext = createContext<UserContextValue | null>(null);

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [databricksHost, setDatabricksHost] = useState<string | null>(null);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Databricks PAT が設定されているかどうかを計算
  const hasPat = useMemo(() => {
    return tokens.some(t => t.provider === 'databricks' && t.auth_type === 'pat');
  }, [tokens]);

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await userService.getCurrentUser();
      setUser(data.user);
      setDatabricksHost(data.databricks_host);
      setTokens(data.tokens ?? []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      console.error('Failed to fetch user:', error);
      setError(error);
      setUser(null);
      setDatabricksHost(null);
      setTokens([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // アプリ初期化時に一度だけ取得
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <UserContext.Provider
      value={{ user, databricksHost, tokens, hasPat, isLoading, error, refetch: fetchUser }}
    >
      {children}
    </UserContext.Provider>
  );
}
