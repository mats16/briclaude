import { Link } from 'react-router-dom';
import { Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

export function AppSidebarHeader() {
  const { t } = useTranslation();

  return (
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
  );
}
