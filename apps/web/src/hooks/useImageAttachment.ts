import { useState, useCallback } from 'react';
import type { AttachedImage } from '@/lib/content-builder';
import {
  encodeImageToWebP,
  isValidImageFile,
  isValidImageSize,
  MAX_IMAGES_PER_MESSAGE,
} from '@/lib/image-utils';

interface UseImageAttachmentOptions {
  maxImages?: number;
  onError?: (message: string) => void;
}

interface UseImageAttachmentReturn {
  images: AttachedImage[];
  isProcessing: boolean;
  addImages: (files: FileList | File[]) => Promise<void>;
  removeImage: (id: string) => void;
  clearImages: () => void;
  hasImages: boolean;
}

export function useImageAttachment(
  options: UseImageAttachmentOptions = {}
): UseImageAttachmentReturn {
  const { maxImages = MAX_IMAGES_PER_MESSAGE, onError } = options;
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addImages = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      // 有効なファイルをフィルタ
      const validFiles = fileArray.filter(file => {
        if (!isValidImageFile(file)) {
          onError?.(`${file.name} is not a supported image format`);
          return false;
        }
        if (!isValidImageSize(file)) {
          onError?.(`${file.name} exceeds maximum file size (20MB)`);
          return false;
        }
        return true;
      });

      // 最大数チェック
      const currentCount = images.length;
      const availableSlots = maxImages - currentCount;

      if (availableSlots <= 0) {
        onError?.(`Maximum ${maxImages} images allowed`);
        return;
      }

      if (validFiles.length > availableSlots) {
        onError?.(`Maximum ${maxImages} images allowed`);
        validFiles.splice(availableSlots);
      }

      if (validFiles.length === 0) return;

      setIsProcessing(true);

      try {
        const newImages: AttachedImage[] = await Promise.all(
          validFiles.map(async file => {
            const preview = URL.createObjectURL(file);
            const encoded = await encodeImageToWebP(file);

            return {
              id: crypto.randomUUID(),
              file,
              preview,
              encoded,
            };
          })
        );

        setImages(prev => [...prev, ...newImages]);
      } catch {
        onError?.('Failed to process image');
      } finally {
        setIsProcessing(false);
      }
    },
    [images.length, maxImages, onError]
  );

  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) {
        URL.revokeObjectURL(img.preview);
      }
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const clearImages = useCallback(() => {
    setImages(prev => {
      prev.forEach(img => URL.revokeObjectURL(img.preview));
      return [];
    });
  }, []);

  return {
    images,
    isProcessing,
    addImages,
    removeImage,
    clearImages,
    hasImages: images.length > 0,
  };
}
