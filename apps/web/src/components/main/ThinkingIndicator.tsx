import { ToyBrick } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTypewriter } from '@/hooks/useTypewriter';
import { BRICK_COLORS } from '@/constants';

const ANIMATION_DELAY_MS = 120;
const TYPEWRITER_SPEED_MS = 120;
const TYPEWRITER_PAUSE_MS = 1500;

export function ThinkingIndicator() {
  const { t } = useTranslation();
  const text = useTypewriter(t('main.thinking'), TYPEWRITER_SPEED_MS, TYPEWRITER_PAUSE_MS);

  return (
    <div className="py-3 mb-8" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-0.5" aria-hidden="true">
          {BRICK_COLORS.map((colorClass, i) => (
            <ToyBrick
              key={i}
              className={`h-4 w-4 animate-wave ${colorClass}`}
              style={{
                animationDelay: `${i * ANIMATION_DELAY_MS}ms`,
              }}
            />
          ))}
        </div>
        <span className="min-w-[85px] text-muted-foreground">
          {text}
          <span className="animate-pulse">|</span>
        </span>
      </div>
    </div>
  );
}
