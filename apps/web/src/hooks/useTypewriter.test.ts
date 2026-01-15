import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypewriter } from './useTypewriter';

describe('useTypewriter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初期状態では空文字列を返す', () => {
    const { result } = renderHook(() => useTypewriter('Test'));

    expect(result.current).toBe('');
  });

  it('時間経過で1文字ずつ表示される', () => {
    const { result } = renderHook(() => useTypewriter('ABC', 100));

    expect(result.current).toBe('');

    // 1文字目
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('A');

    // 2文字目
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('AB');

    // 3文字目
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('ABC');
  });

  it('全て表示後、pauseTime経過でリセットされる', () => {
    const { result } = renderHook(() => useTypewriter('Hi', 100, 500));

    // 全て表示
    act(() => {
      vi.advanceTimersByTime(100); // H
    });
    act(() => {
      vi.advanceTimersByTime(100); // Hi
    });
    expect(result.current).toBe('Hi');

    // pauseTime経過でリセット
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('');
  });

  it('リセット後、再度タイプライターが始まる', () => {
    const { result } = renderHook(() => useTypewriter('AB', 100, 200));

    // 全て表示
    act(() => {
      vi.advanceTimersByTime(100); // A
    });
    act(() => {
      vi.advanceTimersByTime(100); // AB
    });
    expect(result.current).toBe('AB');

    // リセット
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('');

    // 再度開始
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('A');
  });

  it('デフォルトのspeedとpauseTimeが適用される', () => {
    const { result } = renderHook(() => useTypewriter('X'));

    // デフォルトspeed = 120ms
    act(() => {
      vi.advanceTimersByTime(119);
    });
    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('X');

    // デフォルトpauseTime = 1500ms
    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(result.current).toBe('X');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('');
  });
});
