import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type QuickstartType = 'lakeflow' | 'unityCatalog' | 'databricksApps';

interface QuickstartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quickstartType: QuickstartType | null;
}

export function QuickstartModal({ open, onOpenChange, quickstartType }: QuickstartModalProps) {
  const { t } = useTranslation();

  if (!quickstartType) return null;

  const titleKey = `welcome.quickstarts.${quickstartType}.title`;
  const modalDescKey = `welcome.quickstarts.${quickstartType}.modalDescription`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>{t(modalDescKey)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <Construction className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground text-center">{t('welcome.comingSoon')}</p>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
