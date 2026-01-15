import { useState, useEffect } from 'react';

/**
 * テキストをタイプライター風に表示するカスタムフック
 * @param text - 表示するテキスト
 * @param speed - 1文字あたりの表示速度(ミリ秒)
 * @param pauseTime - テキスト表示完了後の一時停止時間(ミリ秒)
 * @returns 現在表示中のテキスト
 */
export function useTypewriter(text: string, speed = 120, pauseTime = 1500): string {
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
