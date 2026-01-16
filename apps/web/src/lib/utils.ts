import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 関数の実行頻度を制限するスロットル関数
 *
 * @param fn - スロットルする関数
 * @param delay - 実行間隔（ミリ秒）
 * @returns スロットルされた関数
 *
 * @example
 * ```typescript
 * const throttledScroll = throttle(() => console.log('scrolled'), 100);
 * window.addEventListener('scroll', throttledScroll);
 * ```
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      // 十分な時間が経過した場合、即座に実行
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      // まだ待機中でなければ、残り時間後に実行をスケジュール
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, delay - timeSinceLastCall);
    }
  };
}
