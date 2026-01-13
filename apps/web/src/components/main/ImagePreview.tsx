import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AttachedImage } from '@/lib/content-builder';

interface ImagePreviewProps {
  images: AttachedImage[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export function ImagePreview({ images, onRemove, disabled }: ImagePreviewProps) {
  if (images.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap px-1 pb-2">
      {images.map(img => (
        <div
          key={img.id}
          className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted"
        >
          <img src={img.preview} alt="Attached" className="w-full h-full object-cover" />
          {!disabled && (
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-1 -right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(img.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
