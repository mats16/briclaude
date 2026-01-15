import { ToyBrick } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  speed?: 'slow' | 'normal' | 'fast';
}

export function LoadingSpinner({ size = 'md', speed = 'normal' }: LoadingSpinnerProps) {
  const sizes = {
    sm: { container: 'w-12 h-12', icon: 'w-4 h-4', radius: 16 },
    md: { container: 'w-20 h-20', icon: 'w-5 h-5', radius: 28 },
    lg: { container: 'w-28 h-28', icon: 'w-7 h-7', radius: 40 },
  };

  const speeds = {
    slow: '3s',
    normal: '2s',
    fast: '1.2s',
  };

  const colors = ['#8B5CF6', '#EC4899', '#3B82F6'];
  const { container, icon, radius } = sizes[size];

  return (
    <div className={`relative ${container}`}>
      <div
        className="absolute inset-0 animate-spin"
        style={{ animationDuration: speeds[speed] }}
      >
        {[0, 120, 240].map((deg, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
              transform: `rotate(${deg}deg) translateY(-${radius}px) rotate(-${deg}deg)`,
            }}
          >
            <ToyBrick className={`${icon} -ml-2.5 -mt-2.5`} style={{ color: colors[i] }} />
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
    <div className="flex flex-col items-center gap-4">
      <LoadingSpinner size={size} speed={speed} />
      {text && <p className="text-gray-400 text-sm">{text}</p>}
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
