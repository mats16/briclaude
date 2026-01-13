import { Link } from 'react-router-dom';
import { Terminal, PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

export function AppSidebarHeader() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col">
      <Link
        to="/"
        className="flex items-center gap-2 h-[50px] px-4 shrink-0 hover:bg-accent/50 transition-colors"
      >
        <Terminal className="h-5 w-5 shrink-0" />
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-foreground whitespace-nowrap">{t('app.title')}</span>
          <Badge variant="secondary" className="text-xs font-normal shrink-0">
            {t('app.badge')}
          </Badge>
        </div>
      </Link>
      <Link
        to="/"
        className="flex items-center gap-2 mx-3 mb-2 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors text-sm text-muted-foreground hover:text-foreground"
      >
        <PlusCircle className="h-4 w-4 shrink-0" />
        <span>{t('sidebar.newSession')}</span>
      </Link>
    </div>
  );
}
