import { useCallback } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import type { RecentWorkspace } from '@repo/types';

const MAX_RECENT_WORKSPACES = 3;
const STORAGE_KEY = 'recent-workspaces';

interface UseRecentWorkspacesReturn {
  recentWorkspaces: RecentWorkspace[];
  addRecentWorkspace: (path: string) => void;
  clearRecentWorkspaces: () => void;
}

/**
 * パスから表示用の名前を抽出する
 * 例: /Workspace/Users/john/project -> project
 */
function extractNameFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

/**
 * 最近使用したWorkspaceパスを管理するフック
 */
export function useRecentWorkspaces(): UseRecentWorkspacesReturn {
  const [recentWorkspaces, setRecentWorkspaces] = useLocalStorageState<RecentWorkspace[]>(
    STORAGE_KEY,
    {
      defaultValue: [],
    }
  );

  const addRecentWorkspace = useCallback(
    (path: string) => {
      setRecentWorkspaces(current => {
        const now = Date.now();
        const name = extractNameFromPath(path);

        // 既存のエントリを除外（重複防止）
        const filtered = current.filter(w => w.path !== path);

        // 新しいエントリを先頭に追加
        const updated: RecentWorkspace[] = [{ path, name, last_used_at: now }, ...filtered];

        // 最大件数に制限
        return updated.slice(0, MAX_RECENT_WORKSPACES);
      });
    },
    [setRecentWorkspaces]
  );

  const clearRecentWorkspaces = useCallback(() => {
    setRecentWorkspaces([]);
  }, [setRecentWorkspaces]);

  return {
    recentWorkspaces,
    addRecentWorkspace,
    clearRecentWorkspaces,
  };
}
