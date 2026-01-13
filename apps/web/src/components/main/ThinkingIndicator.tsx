import { useState, useEffect } from 'react';
import { ToyBrick } from 'lucide-react';

export function ThinkingIndicator() {
  const text = 'Thinking...';
  const [displayedText, setDisplayedText] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, index + 1));
        setIndex(index + 1);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      const resetTimer = setTimeout(() => {
        setDisplayedText('');
        setIndex(0);
      }, 1000);
      return () => clearTimeout(resetTimer);
    }
  }, [index]);

  return (
    <div className="flex items-center gap-2 py-3">
      <ToyBrick className="h-4 w-4 text-foreground animate-squish" />
      <span className="text-sm text-muted-foreground">
        {displayedText}
        <span className="animate-pulse">|</span>
      </span>
    </div>
  );
}
