import { useState, useEffect } from 'react';

export function useTypewriter(
  text: string,
  speed = 120,
  pauseTime = 1500
): string {
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
