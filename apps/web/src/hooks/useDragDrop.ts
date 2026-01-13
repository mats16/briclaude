import { useState, useEffect, useRef, type RefObject } from 'react';

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

  // 最新のオプションをrefで保持して、イベントリスナーの再登録を防ぐ
  const optionsRef = useRef({ onDrop, accept, disabled });
  optionsRef.current = { onDrop, accept, disabled };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const matchesAccept = (fileType: string, acceptTypes: string[]) =>
      acceptTypes.some(type => {
        if (type.endsWith('/*')) {
          return fileType.startsWith(type.replace('/*', '/'));
        }
        return fileType === type;
      });

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (optionsRef.current.disabled) return;

      dragCounterRef.current += 1;

      if (e.dataTransfer?.items) {
        const hasValidItem = Array.from(e.dataTransfer.items).some(
          item => item.kind === 'file' && matchesAccept(item.type, optionsRef.current.accept)
        );
        if (hasValidItem) {
          setIsDragging(true);
        }
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      dragCounterRef.current -= 1;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(false);
      dragCounterRef.current = 0;

      if (optionsRef.current.disabled) return;

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        // 画像ファイルのみフィルタ
        const imageFiles = Array.from(files).filter(file =>
          matchesAccept(file.type, optionsRef.current.accept)
        );

        if (imageFiles.length > 0) {
          // FileList を作成できないので、DataTransfer を使用
          const dt = new DataTransfer();
          imageFiles.forEach(file => dt.items.add(file));
          optionsRef.current.onDrop(dt.files);
        }
      }
    };

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
  }, [ref]);

  return { isDragging };
}
