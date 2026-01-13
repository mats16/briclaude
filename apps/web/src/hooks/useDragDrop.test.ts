import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragDrop } from './useDragDrop';
import { useRef } from 'react';

// Helper to create mock DataTransfer with items
function createMockDataTransfer(files: File[]): DataTransfer {
  const dataTransfer = new DataTransfer();
  const items: DataTransferItem[] = files.map(file => ({
    kind: 'file' as const,
    type: file.type,
    getAsFile: () => file,
    getAsString: () => {},
    webkitGetAsEntry: () => null,
  }));

  Object.defineProperty(dataTransfer, 'items', {
    value: {
      length: items.length,
      add: (file: File) => {
        files.push(file);
      },
      [Symbol.iterator]: function* () {
        for (const item of items) yield item;
      },
      ...items.reduce((acc, item, i) => ({ ...acc, [i]: item }), {}),
    },
  });

  // Update files
  files.forEach(file => {
    try {
      (dataTransfer as DataTransfer).items.add(file);
    } catch {
      // DataTransfer mock may not support add in jsdom
    }
  });

  return dataTransfer;
}

// Helper to create DragEvent
function createDragEvent(type: string, dataTransfer?: DataTransfer): DragEvent {
  const event = new Event(type, { bubbles: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', {
    value: dataTransfer,
    writable: false,
  });
  return event;
}

// Custom wrapper to provide ref
function useTestHook(options: Parameters<typeof useDragDrop>[1]) {
  const ref = useRef<HTMLDivElement | null>(null);
  const result = useDragDrop(ref, options);
  return { ref, ...result };
}

describe('useDragDrop', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('初期状態では isDragging が false', () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTestHook({ onDrop }));

    expect(result.current.isDragging).toBe(false);
  });

  it('dragenter で isDragging が true になる', () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTestHook({ onDrop }));

    // Ref を設定
    act(() => {
      result.current.ref.current = container;
    });

    // Re-render to attach listeners
    const { result: result2 } = renderHook(() => useDragDrop(result.current.ref, { onDrop }));

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const dataTransfer = createMockDataTransfer([file]);
    const event = createDragEvent('dragenter', dataTransfer);

    act(() => {
      container.dispatchEvent(event);
    });

    expect(result2.current.isDragging).toBe(true);
  });

  it('dragleave で isDragging が false になる', () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTestHook({ onDrop }));

    act(() => {
      result.current.ref.current = container;
    });

    const { result: result2 } = renderHook(() => useDragDrop(result.current.ref, { onDrop }));

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const dataTransfer = createMockDataTransfer([file]);

    // Enter
    act(() => {
      container.dispatchEvent(createDragEvent('dragenter', dataTransfer));
    });

    expect(result2.current.isDragging).toBe(true);

    // Leave
    act(() => {
      container.dispatchEvent(createDragEvent('dragleave', dataTransfer));
    });

    expect(result2.current.isDragging).toBe(false);
  });

  it('drop で onDrop が呼ばれる', () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTestHook({ onDrop }));

    act(() => {
      result.current.ref.current = container;
    });

    renderHook(() => useDragDrop(result.current.ref, { onDrop }));

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const dataTransfer = createMockDataTransfer([file]);

    // ファイルを dataTransfer.files に設定
    Object.defineProperty(dataTransfer, 'files', {
      value: {
        length: 1,
        item: (i: number) => (i === 0 ? file : null),
        [0]: file,
        [Symbol.iterator]: function* () {
          yield file;
        },
      },
    });

    act(() => {
      container.dispatchEvent(createDragEvent('drop', dataTransfer));
    });

    expect(onDrop).toHaveBeenCalled();
  });

  it('disabled が true の場合、dragenter で isDragging が変わらない', () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTestHook({ onDrop, disabled: true }));

    act(() => {
      result.current.ref.current = container;
    });

    const { result: result2 } = renderHook(() =>
      useDragDrop(result.current.ref, { onDrop, disabled: true })
    );

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const dataTransfer = createMockDataTransfer([file]);

    act(() => {
      container.dispatchEvent(createDragEvent('dragenter', dataTransfer));
    });

    expect(result2.current.isDragging).toBe(false);
  });

  it('disabled が true の場合、drop で onDrop が呼ばれない', () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTestHook({ onDrop, disabled: true }));

    act(() => {
      result.current.ref.current = container;
    });

    renderHook(() => useDragDrop(result.current.ref, { onDrop, disabled: true }));

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const dataTransfer = createMockDataTransfer([file]);
    Object.defineProperty(dataTransfer, 'files', {
      value: {
        length: 1,
        item: (i: number) => (i === 0 ? file : null),
        [0]: file,
        [Symbol.iterator]: function* () {
          yield file;
        },
      },
    });

    act(() => {
      container.dispatchEvent(createDragEvent('drop', dataTransfer));
    });

    expect(onDrop).not.toHaveBeenCalled();
  });

  it('非画像ファイルはフィルタされる', () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTestHook({ onDrop }));

    act(() => {
      result.current.ref.current = container;
    });

    renderHook(() => useDragDrop(result.current.ref, { onDrop }));

    const textFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    const dataTransfer = createMockDataTransfer([textFile]);
    Object.defineProperty(dataTransfer, 'files', {
      value: {
        length: 1,
        item: (i: number) => (i === 0 ? textFile : null),
        [0]: textFile,
        [Symbol.iterator]: function* () {
          yield textFile;
        },
      },
    });

    act(() => {
      container.dispatchEvent(createDragEvent('drop', dataTransfer));
    });

    // 画像ファイルがないので onDrop は呼ばれない
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('dragover でデフォルト動作が防止される', () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTestHook({ onDrop }));

    act(() => {
      result.current.ref.current = container;
    });

    renderHook(() => useDragDrop(result.current.ref, { onDrop }));

    const event = createDragEvent('dragover', undefined);
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    act(() => {
      container.dispatchEvent(event);
    });

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('複数回の dragenter/dragleave でカウンターが正しく動作する', () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTestHook({ onDrop }));

    act(() => {
      result.current.ref.current = container;
    });

    const { result: result2 } = renderHook(() => useDragDrop(result.current.ref, { onDrop }));

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const dataTransfer = createMockDataTransfer([file]);

    // 2回 enter
    act(() => {
      container.dispatchEvent(createDragEvent('dragenter', dataTransfer));
      container.dispatchEvent(createDragEvent('dragenter', dataTransfer));
    });

    expect(result2.current.isDragging).toBe(true);

    // 1回 leave（まだ中にいる）
    act(() => {
      container.dispatchEvent(createDragEvent('dragleave', dataTransfer));
    });

    expect(result2.current.isDragging).toBe(true);

    // もう1回 leave（完全に出た）
    act(() => {
      container.dispatchEvent(createDragEvent('dragleave', dataTransfer));
    });

    expect(result2.current.isDragging).toBe(false);
  });
});
