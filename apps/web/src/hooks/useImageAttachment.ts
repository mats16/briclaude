import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { maxImages = MAX_IMAGES_PER_MESSAGE, onError } = options;
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // メモリリーク対策: マウント状態を追跡
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const addImages = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      // 有効なファイルをフィルタ
      const validFiles = fileArray.filter(file => {
        if (!isValidImageFile(file)) {
          onError?.(t('image.unsupportedFormat', { fileName: file.name }));
          return false;
        }
        if (!isValidImageSize(file)) {
          onError?.(t('image.exceedsMaxSize', { fileName: file.name }));
          return false;
        }
        return true;
      });

      // 最大数チェック
      const currentCount = images.length;
      const availableSlots = maxImages - currentCount;

      if (availableSlots <= 0) {
        onError?.(t('image.maxImagesAllowed', { count: maxImages }));
        return;
      }

      if (validFiles.length > availableSlots) {
        onError?.(t('image.maxImagesAllowed', { count: maxImages }));
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

        // メモリリーク対策: アンマウント後は state を更新しない
        if (!isMountedRef.current) {
          // アンマウント済みの場合、作成したオブジェクトURLを解放
          newImages.forEach(img => URL.revokeObjectURL(img.preview));
          return;
        }

        setImages(prev => [...prev, ...newImages]);
      } catch {
        if (isMountedRef.current) {
          onError?.(t('image.processingFailed'));
        }
      } finally {
        if (isMountedRef.current) {
          setIsProcessing(false);
        }
      }
    },
    [images.length, maxImages, onError, t]
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
