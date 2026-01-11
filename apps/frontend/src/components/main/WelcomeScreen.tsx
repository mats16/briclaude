import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Bug, FileSearch, Rocket } from 'lucide-react';
import { QuickstartCard } from './QuickstartCard';
import { QuickstartModal, QuickstartType } from './QuickstartModal';

export function WelcomeScreen() {
  const { t } = useTranslation();
  const [selectedQuickstart, setSelectedQuickstart] = useState<QuickstartType | null>(null);

  const quickstarts = [
    {
      type: 'lakeflow' as const,
      icon: Bug,
      title: t('welcome.quickstarts.lakeflow.title'),
      description: t('welcome.quickstarts.lakeflow.description'),
    },
    {
      type: 'unityCatalog' as const,
      icon: FileSearch,
      title: t('welcome.quickstarts.unityCatalog.title'),
      description: t('welcome.quickstarts.unityCatalog.description'),
    },
    {
      type: 'databricksApps' as const,
      icon: Rocket,
      title: t('welcome.quickstarts.databricksApps.title'),
      description: t('welcome.quickstarts.databricksApps.description'),
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      {/* Logo Icon */}
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>

      {/* Title */}
      <h1 className="text-2xl font-semibold text-foreground mb-2">{t('welcome.title')}</h1>
      <p className="text-muted-foreground text-center mb-8 max-w-md whitespace-pre-line">
        {t('welcome.subtitle')}
      </p>

      {/* Quickstart Cards */}
      <div className="w-full max-w-md space-y-3">
        {quickstarts.map(qs => (
          <QuickstartCard
            key={qs.type}
            icon={qs.icon}
            title={qs.title}
            description={qs.description}
            onClick={() => setSelectedQuickstart(qs.type)}
          />
        ))}
      </div>

      {/* Quickstart Modal */}
      <QuickstartModal
        open={selectedQuickstart !== null}
        onOpenChange={open => !open && setSelectedQuickstart(null)}
        quickstartType={selectedQuickstart}
      />
    </div>
  );
}
