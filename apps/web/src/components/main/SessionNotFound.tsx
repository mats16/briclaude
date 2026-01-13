import { useTranslation } from 'react-i18next';
import { FileQuestion, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarToggleButton } from '@/components/layout/SidebarToggleButton';

interface SessionNotFoundProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onGoHome?: () => void;
}

export function SessionNotFound({
  isSidebarOpen = true,
  onToggleSidebar,
  onGoHome,
}: SessionNotFoundProps) {
  const { t } = useTranslation();

  return (
    <div className="relative z-0 flex flex-col w-full h-full min-w-0 overflow-hidden bg-background">
      {/* Header with toggle button */}
      <div className="flex items-center h-[50px] px-2 border-b border-border shrink-0">
        {onToggleSidebar && (
          <SidebarToggleButton isOpen={isSidebarOpen} onToggle={onToggleSidebar} />
        )}
      </div>

      {/* Not found content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="flex flex-col items-center text-center max-w-md">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <FileQuestion className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{t('main.sessionNotFound')}</h2>
          <p className="text-muted-foreground mb-6">{t('main.sessionNotFoundDescription')}</p>
          <Button onClick={onGoHome} variant="default" className="gap-2">
            <Home className="w-4 h-4" />
            {t('main.goHome')}
          </Button>
        </div>
      </div>
    </div>
  );
}
