import type { Base64ImageSource } from '@repo/types';

/**
 * 画像エンコード設定
 */
export interface ImageEncodingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * デフォルト設定
 * - maxWidth/maxHeight: Claude 推奨の最大サイズ 1568px
 * - quality: 85% (品質とファイルサイズのバランス)
 */
const DEFAULT_OPTIONS: Required<ImageEncodingOptions> = {
  maxWidth: 1568,
  maxHeight: 1568,
  quality: 0.85,
};

/**
 * 最大ファイルサイズ (20MB - Anthropic API 制限)
 */
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

/**
 * 1メッセージあたりの最大画像数
 */
export const MAX_IMAGES_PER_MESSAGE = 5;

/**
 * サポートされる画像 MIME タイプ
 */
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

/**
 * ファイルがサポートされている画像形式かチェック
 */
export function isValidImageFile(file: File): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(file.type as SupportedImageType);
}

/**
 * ファイルサイズが制限内かチェック
 */
export function isValidImageSize(file: File): boolean {
  return file.size <= MAX_IMAGE_SIZE;
}

/**
 * 画像ファイルを WebP 形式の Base64 にエンコード
 * - アスペクト比を維持しながら最大サイズにリサイズ
 * - Canvas API を使用して WebP に変換
 */
export async function encodeImageToWebP(
  file: File,
  options: ImageEncodingOptions = {}
): Promise<Base64ImageSource> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      // アスペクト比を維持しながら最大サイズを計算
      let { width, height } = img;

      if (width > opts.maxWidth || height > opts.maxHeight) {
        const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // 画像を描画
      ctx.drawImage(img, 0, 0, width, height);

      // WebP に変換して Base64 取得
      const dataUrl = canvas.toDataURL('image/webp', opts.quality);
      const base64Data = dataUrl.split(',')[1];

      resolve({
        type: 'base64',
        media_type: 'image/webp',
        data: base64Data,
      });

      // クリーンアップ
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}
