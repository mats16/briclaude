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
  Rocket,
  FolderGit2,
  Check,
  Download,
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
import { jobsService, reposService, workspaceService } from '@/services';
import { useUser } from '@/hooks/useUser';
import type { JobRun, WorkspaceSelection } from '@repo/types';

export type QuickstartType = 'lakeflow' | 'databricksApps' | 'tbd';

interface QuickstartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quickstartType: QuickstartType | null;
  onFillPrompt?: (
    prompt: string,
    workspaceSelection?: WorkspaceSelection,
    enableDatabricksApps?: boolean
  ) => void;
}

/** GitHub API content item */
interface GitHubContent {
  name: string;
  path: string;
  html_url: string;
  type: 'file' | 'dir';
}

/** App template for display */
interface AppTemplate {
  name: string;
  url: string;
  description: string;
}

const GITHUB_TEMPLATES_API_URL = 'https://api.github.com/repos/databricks/app-templates/contents';

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

/**
 * Convert kebab-case template name to human-readable format
 */
function formatTemplateName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
  const [hasError, setHasError] = useState(false);

  const fetchFailedRuns = useCallback(async () => {
    if (!hasPat) return;

    setIsLoading(true);
    setHasError(false);
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
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [hasPat]);

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

  if (hasError) {
    return (
      <div className="flex flex-col items-center py-8">
        <AlertCircle className="h-8 w-8 text-destructive mb-4" aria-hidden="true" />
        <p className="text-sm text-destructive mb-4">{t('quickstart.lakeflow.fetchError')}</p>
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
            <FailedJobRunItem
              key={`${run.job_id}-${run.run_id}`}
              run={run}
              onClick={() => handleJobClick(run)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function AppTemplateItem({
  template,
  selected,
  onClick,
  disabled,
}: {
  template: AppTemplate;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className={`w-full text-left p-3 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50'
      }`}
      onClick={onClick}
      disabled={disabled}
      aria-label={t('quickstart.databricksApps.selectTemplate', { name: template.name })}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {selected ? (
              <Check className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            ) : (
              <FolderGit2 className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            )}
            <span className="font-medium truncate">{template.name}</span>
          </div>
          {template.description && (
            <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
          )}
        </div>
        <a
          href={template.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label={t('quickstart.databricksApps.viewOnGithub')}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </button>
  );
}

const GITHUB_APP_TEMPLATES_REPO_URL = 'https://github.com/databricks/app-templates';

function DatabricksAppsContent({
  onFillPrompt,
  onClose,
}: {
  onFillPrompt?: (
    prompt: string,
    workspaceSelection?: WorkspaceSelection,
    enableDatabricksApps?: boolean
  ) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { user, hasPat } = useUser();
  const [templates, setTemplates] = useState<AppTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AppTemplate | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      // Fetch directly from GitHub API
      const response = await fetch(GITHUB_TEMPLATES_API_URL);
      if (!response.ok) throw new Error('Failed to fetch');
      const data: GitHubContent[] = await response.json();

      // Filter directories only (each directory is a template)
      const templateList: AppTemplate[] = data
        .filter(item => item.type === 'dir' && !item.name.startsWith('.'))
        .map(item => ({
          name: item.name,
          url: item.html_url,
          description: formatTemplateName(item.name),
        }));

      setTemplates(templateList);
    } catch (err) {
      console.error('Failed to fetch app templates:', err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleTemplateSelect = (template: AppTemplate) => {
    if (selectedTemplate?.name === template.name) {
      setSelectedTemplate(null);
    } else {
      setSelectedTemplate(template);
    }
    setCloneError(null);
  };

  const handleClone = async () => {
    if (!selectedTemplate || !onFillPrompt || !hasPat || !user?.email) return;

    setIsCloning(true);
    setCloneError(null);
    try {
      // Construct workspace path: /Workspace/Users/<email>/databricks_apps/<template>-<timestamp>
      const timestamp = Date.now();
      const databricksAppsDir = `/Workspace/Users/${user.email}/databricks_apps`;
      const workspacePath = `${databricksAppsDir}/${selectedTemplate.name}-${timestamp}`;

      // Ensure the databricks_apps directory exists before cloning
      await workspaceService.mkdirs(databricksAppsDir);

      const response = await reposService.createRepo({
        url: GITHUB_APP_TEMPLATES_REPO_URL,
        provider: 'gitHub',
        path: workspacePath,
        sparse_checkout: {
          patterns: [selectedTemplate.name],
        },
      });

      // Clone successful - fill prompt and workspace path
      // sparse checkout でクローンした場合、テンプレートディレクトリはリポジトリ配下にある
      const templatePath = `${response.path}/${selectedTemplate.name}`;

      // テンプレートディレクトリの object_id を取得
      const templateStatus = await workspaceService.getStatus(templatePath);

      const prompt = t('quickstart.databricksApps.presetPrompt', {
        templateName: selectedTemplate.name,
        path: templatePath,
      });

      const workspaceSelection: WorkspaceSelection = {
        path: templatePath,
        name: selectedTemplate.name,
        object_type: templateStatus.object_type,
        object_id: templateStatus.object_id,
      };

      onFillPrompt(prompt, workspaceSelection, true);
      onClose();
    } catch (err) {
      console.error('Failed to clone template:', err);
      setCloneError(t('quickstart.databricksApps.cloneError'));
    } finally {
      setIsCloning(false);
    }
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

  if (hasError) {
    return (
      <div className="flex flex-col items-center py-8">
        <AlertCircle className="h-8 w-8 text-destructive mb-4" aria-hidden="true" />
        <p className="text-sm text-destructive mb-4">{t('quickstart.databricksApps.fetchError')}</p>
        <Button variant="outline" size="sm" onClick={fetchTemplates}>
          <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
          <Rocket className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-foreground text-center">
          {t('quickstart.databricksApps.noTemplates')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('quickstart.databricksApps.templatesCount', { count: templates.length })}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchTemplates}
          disabled={isLoading || isCloning}
          aria-label={t('common.retry')}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </Button>
      </div>
      {cloneError && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{cloneError}</p>
        </div>
      )}
      <ScrollArea className="max-h-[300px]">
        <div className="flex flex-col gap-2 pr-4">
          {templates.map(template => (
            <AppTemplateItem
              key={template.name}
              template={template}
              selected={selectedTemplate?.name === template.name}
              onClick={() => handleTemplateSelect(template)}
              disabled={isCloning}
            />
          ))}
        </div>
      </ScrollArea>
      <div className="flex items-center justify-between pt-2 border-t">
        <p className="text-xs text-muted-foreground">{t('quickstart.databricksApps.cloneInfo')}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleClone} disabled={!selectedTemplate || isCloning} size="sm">
            {isCloning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            )}
            {t('quickstart.databricksApps.clone')}
          </Button>
        </div>
      </div>
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

const QUICKSTART_ICONS: Record<QuickstartType, React.ElementType> = {
  lakeflow: Bug,
  databricksApps: Rocket,
  tbd: Construction,
};

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
  const Icon = QUICKSTART_ICONS[quickstartType];

  const handleClose = () => onOpenChange(false);

  const renderContent = () => {
    switch (quickstartType) {
      case 'lakeflow':
        return <LakeflowContent onFillPrompt={onFillPrompt} onClose={handleClose} />;
      case 'databricksApps':
        return <DatabricksAppsContent onFillPrompt={onFillPrompt} onClose={handleClose} />;
      default:
        return <ComingSoonContent />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>Quickstart: {t(titleKey)}</span>
          </DialogTitle>
          <DialogDescription>{t(modalDescKey)}</DialogDescription>
        </DialogHeader>

        {renderContent()}

        {quickstartType !== 'databricksApps' && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
