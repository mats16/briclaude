import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { UserInfo } from '@repo/types';
import { userService } from '@/services';

export interface UserContextValue {
  user: UserInfo | null;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await userService.getCurrentUser();
      setUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // アプリ初期化時に一度だけ取得
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <UserContext.Provider value={{ user, isLoading, error, refetch: fetchUser }}>
      {children}
    </UserContext.Provider>
  );
}
