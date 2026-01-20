import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, FolderCode, Settings, Logs } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { APP_STATUS_POLLING_INTERVAL_MS } from '@/constants';
import type { DatabricksApp } from '@repo/types';

interface FloatingButtonsProps {
  sessionId: string;
  showAppButton: boolean;
  showWorkspaceButton: boolean;
  workspacePath?: string;
}

type ComputeStateType =
  | 'STARTING'
  | 'RUNNING'
  | 'STOPPING'
  | 'STOPPED'
  | 'ERROR'
  | 'UNKNOWN';

export function FloatingButtons({
  sessionId,
  showAppButton,
  showWorkspaceButton,
  workspacePath,
}: FloatingButtonsProps) {
  const { t } = useTranslation();
  const [appInfo, setAppInfo] = useState<DatabricksApp | null>(null);
  // fetchAppInfo の最新版を保持する ref（interval 内で常に最新を参照するため）
  const fetchAppInfoRef = useRef<() => Promise<void>>(undefined);

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

  // fetchAppInfo が更新されたら ref も更新
  useEffect(() => {
    fetchAppInfoRef.current = fetchAppInfo;
  }, [fetchAppInfo]);

  // 初回マウント時にアプリ情報を取得 + 5秒おきにポーリング
  // showAppButton の変更時のみ interval を再設定（sessionId 変更時は ref 経由で最新を参照）
  useEffect(() => {
    if (!showAppButton) return;

    // 初回取得
    fetchAppInfoRef.current?.();

    const intervalId = setInterval(() => {
      fetchAppInfoRef.current?.();
    }, APP_STATUS_POLLING_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [showAppButton]);

  const computeState: ComputeStateType =
    (appInfo?.compute_status?.state as ComputeStateType) ?? 'UNKNOWN';
  const computeMessage = appInfo?.compute_status?.message;

  const getRocketIconClass = () => {
    switch (computeState) {
      case 'RUNNING':
        return 'text-green-500';
      case 'STARTING':
      case 'STOPPING':
        return 'text-yellow-500 animate-spin';
      case 'ERROR':
        return 'text-red-500';
      case 'STOPPED':
      default:
        return 'text-foreground';
    }
  };

  const getBadgeVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (computeState) {
      case 'RUNNING':
        return 'default';
      case 'ERROR':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getBadgeClass = () => {
    switch (computeState) {
      case 'RUNNING':
        return 'bg-green-500 hover:bg-green-500';
      case 'STARTING':
      case 'STOPPING':
        return 'bg-yellow-500 hover:bg-yellow-500 text-black';
      case 'ERROR':
        return 'bg-red-500 hover:bg-red-500';
      case 'STOPPED':
      default:
        return '';
    }
  };

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
            <div className="flex items-center h-8 px-3 rounded-lg shadow-lg bg-background border gap-2">
              <button
                className="flex items-center gap-1 hover:opacity-70 disabled:opacity-50"
                onClick={handleOpenApp}
                disabled={!appInfo?.url}
              >
                <Rocket className={cn('h-4 w-4', getRocketIconClass())} />
                <span className="text-sm font-medium">{t('databricksApp.app')}</span>
              </button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant={getBadgeVariant()}
                      className={cn('text-xs px-1.5 py-0 cursor-default', getBadgeClass())}
                    >
                      {computeState}
                    </Badge>
                  </TooltipTrigger>
                  {computeMessage && (
                    <TooltipContent>
                      <p>{computeMessage}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <span className="text-muted-foreground">|</span>
              <button
                className="flex items-center gap-1 hover:opacity-70 disabled:opacity-50"
                onClick={handleOpenLogs}
                disabled={!appInfo?.url}
              >
                <Logs className="h-4 w-4 text-foreground" />
                <span className="text-sm font-medium">{t('databricksApp.logs')}</span>
              </button>
              <span className="text-muted-foreground">|</span>
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
