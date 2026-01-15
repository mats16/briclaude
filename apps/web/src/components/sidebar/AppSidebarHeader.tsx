import { Link } from 'react-router-dom';
import { ToyBrick, PlusCircle, PanelLeft, PanelLeftClose } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function AppSidebarHeader() {
  const { t } = useTranslation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <div className="flex flex-col">
      {/* Header with logo */}
      <div
        className={cn(
          'flex items-center h-[50px] shrink-0',
          isCollapsed ? 'justify-center px-0' : 'justify-between px-4'
        )}
      >
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleSidebar}
                aria-label={t('sidebar.openSidebar')}
                className="group relative flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
              >
                <ToyBrick className="h-5 w-5 shrink-0 group-hover:hidden" />
                <PanelLeft className="h-5 w-5 shrink-0 hidden group-hover:block" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t('sidebar.openSidebar')}</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <ToyBrick className="h-5 w-5 shrink-0" />
              <span className="font-semibold text-foreground whitespace-nowrap">
                {t('app.title')}
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  aria-label={t('sidebar.closeSidebar')}
                  className="h-8 w-8 shrink-0"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('sidebar.closeSidebar')}</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* New session button */}
      {isCollapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/"
              aria-label={t('sidebar.newSession')}
              className="flex items-center justify-center mx-auto mb-2 h-8 w-8 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{t('sidebar.newSession')}</TooltipContent>
        </Tooltip>
      ) : (
        <Link
          to="/"
          className="flex items-center gap-2 mx-3 mb-2 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-sm font-medium text-foreground shadow-sm"
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span>{t('sidebar.newSession')}</span>
        </Link>
      )}
    </div>
  );
}
