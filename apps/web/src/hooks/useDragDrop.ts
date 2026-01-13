import { useState, useCallback, useEffect, useRef, type RefObject } from 'react';

interface UseDragDropOptions {
  onDrop: (files: FileList) => void;
  accept?: string[];
  disabled?: boolean;
}

interface UseDragDropReturn {
  isDragging: boolean;
}

export function useDragDrop(
  ref: RefObject<HTMLElement | null>,
  options: UseDragDropOptions
): UseDragDropReturn {
  const { onDrop, accept = ['image/*'], disabled = false } = options;
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      dragCounterRef.current += 1;

      if (e.dataTransfer?.items) {
        const hasValidItem = Array.from(e.dataTransfer.items).some(item => {
          if (item.kind !== 'file') return false;
          return accept.some(type => {
            if (type.endsWith('/*')) {
              return item.type.startsWith(type.replace('/*', '/'));
            }
            return item.type === type;
          });
        });
        if (hasValidItem) {
          setIsDragging(true);
        }
      }
    },
    [accept, disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(false);
      dragCounterRef.current = 0;

      if (disabled) return;

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        // 画像ファイルのみフィルタ
        const imageFiles = Array.from(files).filter(file =>
          accept.some(type => {
            if (type.endsWith('/*')) {
              return file.type.startsWith(type.replace('/*', '/'));
            }
            return file.type === type;
          })
        );

        if (imageFiles.length > 0) {
          // FileList を作成できないので、DataTransfer を使用
          const dt = new DataTransfer();
          imageFiles.forEach(file => dt.items.add(file));
          onDrop(dt.files);
        }
      }
    },
    [accept, disabled, onDrop]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('dragenter', handleDragEnter);
    element.addEventListener('dragleave', handleDragLeave);
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);

    return () => {
      element.removeEventListener('dragenter', handleDragEnter);
      element.removeEventListener('dragleave', handleDragLeave);
      element.removeEventListener('dragover', handleDragOver);
      element.removeEventListener('drop', handleDrop);
    };
  }, [ref, handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return { isDragging };
}
