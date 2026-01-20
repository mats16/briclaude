import { useCallback } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import type { RecentWorkspace, WorkspaceObjectType } from '@repo/types';
import { extractNameFromPath, MAX_RECENT_WORKSPACES } from '@/lib/workspace';

const STORAGE_KEY = 'recent-workspaces';

interface UseRecentWorkspacesReturn {
  recentWorkspaces: RecentWorkspace[];
  addRecentWorkspace: (path: string, objectId: number, objectType: WorkspaceObjectType) => void;
  clearRecentWorkspaces: () => void;
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
    (path: string, objectId: number, objectType: WorkspaceObjectType) => {
      setRecentWorkspaces(current => {
        const now = Date.now();
        const name = extractNameFromPath(path);

        // 既存のエントリを除外（重複防止）
        const filtered = current.filter(w => w.path !== path);

        // 新しいエントリを先頭に追加
        const updated: RecentWorkspace[] = [
          { path, name, last_used_at: now, object_type: objectType, object_id: objectId },
          ...filtered,
        ];

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
