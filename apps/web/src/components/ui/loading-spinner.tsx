import { ToyBrick } from 'lucide-react';
import { BRICK_COLORS } from '@/constants';

const BRICK_DEGREES = [0, 120, 240];

const ORBIT_RADIUS_PX = {
  sm: 16,
  md: 28,
  lg: 40,
} as const;

const SPINNER_SIZES = {
  sm: { container: 'w-12 h-12', icon: 'w-4 h-4' },
  md: { container: 'w-20 h-20', icon: 'w-5 h-5' },
  lg: { container: 'w-28 h-28', icon: 'w-7 h-7' },
} as const;

const ANIMATION_DURATION = {
  slow: '3s',
  normal: '2s',
  fast: '1.2s',
} as const;

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  speed?: 'slow' | 'normal' | 'fast';
}

export function LoadingSpinner({ size = 'md', speed = 'normal' }: LoadingSpinnerProps) {
  const { container, icon } = SPINNER_SIZES[size];
  const radius = ORBIT_RADIUS_PX[size];

  return (
    <div className={`relative ${container}`} aria-hidden="true">
      <div
        className="absolute inset-0 animate-spin"
        style={{ animationDuration: ANIMATION_DURATION[speed] }}
      >
        {BRICK_DEGREES.map((deg, i) => (
          <div
            key={deg}
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
              transform: `rotate(${deg}deg) translateY(-${radius}px) rotate(-${deg}deg)`,
            }}
          >
            <ToyBrick
              className={`${icon} ${BRICK_COLORS[i]}`}
              style={{ transform: 'translate(-50%, -50%)' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface LoadingScreenProps {
  size?: 'sm' | 'md' | 'lg';
  speed?: 'slow' | 'normal' | 'fast';
  text?: string;
  fullScreen?: boolean;
}

export function LoadingScreen({
  size = 'md',
  speed = 'normal',
  text,
  fullScreen = true,
}: LoadingScreenProps) {
  const content = (
    <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
      <LoadingSpinner size={size} speed={speed} />
      {text ? (
        <p className="text-gray-400 text-sm">{text}</p>
      ) : (
        <span className="sr-only">Loading...</span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
}
