import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { agentService } from '@/services';
import type {
  AgentInfo,
  AgentDetail,
  AgentCreateRequest,
  AgentImportRequest,
  AgentUpdateRequest,
} from '@repo/types';

/**
 * エージェント管理のカスタムフック
 * 状態管理とAPI呼び出しロジックを集約
 */
export function useAgents() {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * エージェント一覧を取得
   */
  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await agentService.getAgents();
      setAgents(response.agents);
    } catch {
      setError(t('agents.fetchError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  /**
   * エージェントを作成
   */
  const createAgent = useCallback(
    async (data: AgentCreateRequest) => {
      await agentService.createAgent(data);
      await fetchAgents();
    },
    [fetchAgents]
  );

  /**
   * Gitリポジトリからエージェントをインポート
   */
  const importAgents = useCallback(
    async (data: AgentImportRequest) => {
      await agentService.importFromGit(data);
      await fetchAgents();
    },
    [fetchAgents]
  );

  /**
   * エージェントを更新
   */
  const updateAgent = useCallback(
    async (name: string, data: AgentUpdateRequest) => {
      await agentService.updateAgent(name, data);
      await fetchAgents();
    },
    [fetchAgents]
  );

  /**
   * エージェントを削除
   */
  const deleteAgent = useCallback(
    async (name: string) => {
      try {
        await agentService.deleteAgent(name);
        await fetchAgents();
      } catch {
        setError(t('agents.deleteError'));
      }
    },
    [fetchAgents, t]
  );

  /**
   * エージェント詳細を取得
   */
  const getAgentDetail = useCallback(
    async (name: string): Promise<AgentDetail | null> => {
      try {
        const response = await agentService.getAgent(name);
        return response.agent;
      } catch {
        setError(t('agents.fetchError'));
        return null;
      }
    },
    [t]
  );

  /**
   * エージェントをWorkspaceにバックアップ
   */
  const backupAgents = useCallback(async () => {
    await agentService.backup();
    toast.success(t('agents.backupDialog.success'));
    await fetchAgents();
  }, [fetchAgents, t]);

  /**
   * Workspaceからエージェントをリストア
   */
  const restoreAgents = useCallback(async () => {
    await agentService.restore();
    toast.success(t('agents.restoreDialog.success'));
    await fetchAgents();
  }, [fetchAgents, t]);

  return {
    // State
    agents,
    isLoading,
    error,

    // Actions
    fetchAgents,
    createAgent,
    importAgents,
    updateAgent,
    deleteAgent,
    getAgentDetail,
    backupAgents,
    restoreAgents,
  };
}
