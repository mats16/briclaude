import { useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserSettingsModal } from '@/components/settings/UserSettingsModal';
import { Skeleton } from '@/components/ui/skeleton';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { UserFooterCollapsed } from './UserFooterCollapsed';
import { UserFooterExpanded } from './UserFooterExpanded';

interface UserFooterProps {
  userName?: string;
  databricksHost?: string | null;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function UserFooter({
  userName,
  databricksHost,
  isLoading,
  error,
  onRetry,
}: UserFooterProps) {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const displayName = userName || t('user.defaultName');
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          'h-[50px] flex items-center border-t border-border shrink-0',
          isCollapsed ? 'justify-center px-0' : 'px-3'
        )}
      >
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={cn(
          'h-[50px] flex items-center gap-2 border-t border-border shrink-0',
          isCollapsed ? 'justify-center px-0' : 'px-3'
        )}
      >
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onRetry}
                className="flex items-center justify-center h-8 w-8 rounded-md text-destructive hover:bg-accent transition-colors"
              >
                <AlertCircle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t('user.loadError')}</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs truncate">{t('user.loadError')}</span>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="p-1 rounded hover:bg-muted transition-colors"
                aria-label={t('common.retry')}
              >
                <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  const handleSettingsOpen = () => setSettingsOpen(true);

  return (
    <>
      {isCollapsed ? (
        <UserFooterCollapsed
          displayName={displayName}
          initials={initials}
          databricksHost={databricksHost}
          onSettingsOpen={handleSettingsOpen}
        />
      ) : (
        <UserFooterExpanded
          displayName={displayName}
          initials={initials}
          databricksHost={databricksHost}
          onSettingsOpen={handleSettingsOpen}
        />
      )}

      <UserSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        databricksHost={databricksHost}
      />
    </>
  );
}
