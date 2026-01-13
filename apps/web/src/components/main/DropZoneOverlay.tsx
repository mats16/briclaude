import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface DropZoneOverlayProps {
  isVisible: boolean;
}

export function DropZoneOverlay({ isVisible }: DropZoneOverlayProps) {
  const { t } = useTranslation();

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 z-50 flex items-center justify-center',
        'bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg'
      )}
    >
      <div className="flex flex-col items-center gap-2 text-primary">
        <Upload className="h-12 w-12" />
        <span className="text-lg font-medium">{t('main.dropImageHere')}</span>
      </div>
    </div>
  );
}
