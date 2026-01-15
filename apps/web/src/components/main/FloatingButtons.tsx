import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, FolderCode, Settings, Logs } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DatabricksApp } from '@repo/types';

interface FloatingButtonsProps {
  sessionId: string;
  showAppButton: boolean;
  showWorkspaceButton: boolean;
  workspacePath?: string;
}

export function FloatingButtons({
  sessionId,
  showAppButton,
  showWorkspaceButton,
  workspacePath,
}: FloatingButtonsProps) {
  const { t } = useTranslation();
  const [appInfo, setAppInfo] = useState<DatabricksApp | null>(null);

  const fetchAppInfo = useCallback(async () => {
    if (!showAppButton) return;
    try {
      const response = await fetch(`/api/sessions/${sessionId}/app`);
      if (!response.ok) {
        setAppInfo(null);
        return;
      }
      const data: DatabricksApp = await response.json();
      setAppInfo(data);
    } catch {
      setAppInfo(null);
    }
  }, [sessionId, showAppButton]);

  // 初回マウント時にアプリ情報を取得
  useEffect(() => {
    if (showAppButton) {
      fetchAppInfo();
    }
  }, [fetchAppInfo, showAppButton]);

  const isAppRunning = appInfo?.compute_status?.state === 'RUNNING';

  const handleOpenApp = () => {
    if (appInfo?.url) {
      window.open(appInfo.url, '_blank');
    }
  };

  const handleOpenLogs = () => {
    if (appInfo?.url) {
      window.open(`${appInfo.url}/logz`, '_blank');
    }
  };

  const handleOpenConsole = () => {
    if (appInfo?.name) {
      const databricksHost = import.meta.env.DATABRICKS_HOST;
      const consoleUrl = `https://${databricksHost}/apps/${appInfo.name}`;
      window.open(consoleUrl, '_blank');
    }
  };

  const handleOpenWorkspace = () => {
    if (!workspacePath) return;
    const databricksHost = import.meta.env.DATABRICKS_HOST;
    const workspaceUrl = `https://${databricksHost}/#workspace${workspacePath}`;
    window.open(workspaceUrl, '_blank');
  };

  if (!showAppButton && !showWorkspaceButton) {
    return null;
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 pb-[7.5rem] px-4 pointer-events-none z-10">
      <div className="w-full max-w-[735px] mx-auto flex justify-between items-center pointer-events-auto">
        {/* 左側: App ボタン */}
        <div>
          {showAppButton && (
            <div className="flex items-center h-8 px-3 rounded-lg shadow-lg bg-background border">
              <button
                className="flex items-center gap-1 hover:opacity-70 disabled:opacity-50"
                onClick={handleOpenApp}
                disabled={!appInfo?.url}
              >
                <Rocket
                  className={cn('h-4 w-4', isAppRunning ? 'text-green-500' : 'text-foreground')}
                />
                <span className="text-sm font-medium">{t('databricksApp.app')}</span>
              </button>
              <span className="text-muted-foreground mx-2">|</span>
              <button
                className="flex items-center gap-1 hover:opacity-70 disabled:opacity-50"
                onClick={handleOpenLogs}
                disabled={!appInfo?.url}
              >
                <Logs className="h-4 w-4 text-foreground" />
                <span className="text-sm font-medium">{t('databricksApp.logs')}</span>
              </button>
              <span className="text-muted-foreground mx-2">|</span>
              <button
                className="hover:opacity-70 disabled:opacity-50"
                onClick={handleOpenConsole}
                disabled={!appInfo?.name}
              >
                <Settings className="h-4 w-4 text-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* 右側: Workspace ボタン */}
        <div>
          {showWorkspaceButton && workspacePath && (
            <div className="flex items-center h-8 px-3 rounded-lg shadow-lg bg-background border">
              <button
                className="flex items-center gap-1 hover:opacity-70"
                onClick={handleOpenWorkspace}
              >
                <FolderCode className="h-4 w-4 text-foreground" />
                <span className="text-sm font-medium">{t('databricksApp.workspace')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
