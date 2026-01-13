import { Link } from 'react-router-dom';
import { Terminal, PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function AppSidebarHeader() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 h-[50px] px-4 shrink-0">
        <Terminal className="h-5 w-5 shrink-0" />
        <span className="font-semibold text-foreground whitespace-nowrap">{t('app.title')}</span>
      </div>
      <Link
        to="/"
        className="flex items-center gap-2 mx-3 mb-2 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-sm font-medium text-foreground shadow-sm"
      >
        <PlusCircle className="h-4 w-4 shrink-0" />
        <span>{t('sidebar.newSession')}</span>
      </Link>
    </div>
  );
}
