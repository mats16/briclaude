import { useState, useEffect } from 'react';
import { Circle, ToyBrick } from 'lucide-react';

const BRICK_COLORS = ['#8B5CF6', '#EC4899', '#3B82F6'];

function useTypewriter(text: string, speed = 120, pauseTime = 1500): string {
  const [displayText, setDisplayText] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(text.slice(0, index + 1));
        setIndex(index + 1);
      }, speed);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setDisplayText('');
        setIndex(0);
      }, pauseTime);
      return () => clearTimeout(timeout);
    }
  }, [index, text, speed, pauseTime]);

  return displayText;
}

export function ThinkingIndicator() {
  const text = useTypewriter('Thinking…');

  return (
    <div className="py-3 mb-8">
      <div className="flex items-start gap-1 py-1 text-sm text-foreground">
        <Circle className="h-2 w-2 fill-current flex-shrink-0 mt-2" />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {BRICK_COLORS.map((color, i) => (
              <ToyBrick
                key={i}
                className="h-4 w-4 animate-wave"
                style={{
                  color,
                  animationDelay: `${i * 0.12}s`,
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
    </div>
  );
}
