import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Construction,
  AlertCircle,
  ExternalLink,
  Clock,
  Loader2,
  RefreshCw,
  Bug,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { jobsService } from '@/services';
import { useUser } from '@/hooks/useUser';
import type { JobRun } from '@repo/types';

export type QuickstartType = 'lakeflow' | 'unityCatalog' | 'databricksApps';

interface QuickstartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quickstartType: QuickstartType | null;
  onFillPrompt?: (prompt: string) => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 24時間以内なら時間のみ
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  // それ以外は日付
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function FailedJobRunItem({
  run,
  onClick,
  disabled,
}: {
  run: JobRun;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const duration = run.execution_duration ?? 0;
  const runName = run.run_name || `Run ${run.run_id}`;

  return (
    <button
      type="button"
      className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={onClick}
      disabled={disabled}
      aria-label={t('quickstart.lakeflow.investigateJob', { runName })}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
            <span className="font-medium truncate">{runName}</span>
          </div>
          {run.state?.state_message && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {run.state.state_message}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground shrink-0">
          {run.start_time && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {formatTimestamp(run.start_time)}
            </span>
          )}
          {duration > 0 && <span>{formatDuration(duration)}</span>}
        </div>
      </div>
      {run.run_page_url && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          <span className="truncate">Job ID: {run.job_id}</span>
        </div>
      )}
    </button>
  );
}

function LakeflowContent({
  onFillPrompt,
  onClose,
}: {
  onFillPrompt?: (prompt: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { hasPat } = useUser();
  const [failedRuns, setFailedRuns] = useState<JobRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFailedRuns = useCallback(async () => {
    if (!hasPat) return;

    setIsLoading(true);
    setError(null);
    try {
      // 直近7日間の失敗したジョブを取得 (Databricks API max limit is 25)
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const response = await jobsService.getFailedJobRuns({
        limit: 25,
        start_time_from: sevenDaysAgo,
      });
      setFailedRuns(response.runs ?? []);
    } catch (err) {
      console.error('Failed to fetch failed job runs:', err);
      setError(t('quickstart.lakeflow.fetchError'));
    } finally {
      setIsLoading(false);
    }
  }, [hasPat, t]);

  useEffect(() => {
    fetchFailedRuns();
  }, [fetchFailedRuns]);

  const handleJobClick = (run: JobRun) => {
    if (!onFillPrompt) return;

    const prompt = t('quickstart.lakeflow.presetPrompt', {
      jobId: run.job_id,
      runId: run.run_id,
      runName: run.run_name || `Run ${run.run_id}`,
      errorMessage: run.state?.state_message || 'Unknown error',
    });

    onFillPrompt(prompt);
    onClose();
  };

  if (!hasPat) {
    return (
      <div className="flex flex-col items-center py-8">
        <AlertCircle className="h-8 w-8 text-muted-foreground mb-4" aria-hidden="true" />
        <p className="text-sm text-muted-foreground text-center">{t('workspace.patRequired')}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-8">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-4" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-8">
        <AlertCircle className="h-8 w-8 text-destructive mb-4" aria-hidden="true" />
        <p className="text-sm text-destructive mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchFailedRuns}>
          <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  if (failedRuns.length === 0) {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
          <AlertCircle className="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-foreground text-center">
          {t('quickstart.lakeflow.noFailedJobs')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('quickstart.lakeflow.failedJobsCount', { count: failedRuns.length })}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchFailedRuns}
          disabled={isLoading}
          aria-label={t('common.retry')}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </Button>
      </div>
      <ScrollArea className="max-h-[300px]">
        <div className="flex flex-col gap-2 pr-4">
          {failedRuns.map(run => (
            <FailedJobRunItem key={run.run_id} run={run} onClick={() => handleJobClick(run)} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function ComingSoonContent() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center py-8">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
        <Construction className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm text-muted-foreground text-center">{t('welcome.comingSoon')}</p>
    </div>
  );
}

export function QuickstartModal({
  open,
  onOpenChange,
  quickstartType,
  onFillPrompt,
}: QuickstartModalProps) {
  const { t } = useTranslation();

  if (!quickstartType) return null;

  const titleKey = `welcome.quickstarts.${quickstartType}.title`;
  const modalDescKey = `welcome.quickstarts.${quickstartType}.modalDescription`;

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" aria-hidden="true" />
            <span>Quickstart: {t(titleKey)}</span>
          </DialogTitle>
          <DialogDescription>{t(modalDescKey)}</DialogDescription>
        </DialogHeader>

        {quickstartType === 'lakeflow' ? (
          <LakeflowContent onFillPrompt={onFillPrompt} onClose={handleClose} />
        ) : (
          <ComingSoonContent />
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
