import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isValidImageFile,
  isValidImageSize,
  encodeImageToWebP,
  MAX_IMAGE_SIZE,
  MAX_IMAGES_PER_MESSAGE,
  SUPPORTED_IMAGE_TYPES,
} from './image-utils';

// Helper to create mock File
function createMockFile(type: string, size: number = 1024): File {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], 'test-file', { type });
}

describe('Constants', () => {
  it('MAX_IMAGE_SIZE は 20MB', () => {
    expect(MAX_IMAGE_SIZE).toBe(20 * 1024 * 1024);
  });

  it('MAX_IMAGES_PER_MESSAGE は 5', () => {
    expect(MAX_IMAGES_PER_MESSAGE).toBe(5);
  });

  it('SUPPORTED_IMAGE_TYPES は正しい形式を含む', () => {
    expect(SUPPORTED_IMAGE_TYPES).toContain('image/jpeg');
    expect(SUPPORTED_IMAGE_TYPES).toContain('image/png');
    expect(SUPPORTED_IMAGE_TYPES).toContain('image/gif');
    expect(SUPPORTED_IMAGE_TYPES).toContain('image/webp');
  });
});

describe('isValidImageFile', () => {
  it('JPEG ファイルは有効', () => {
    const file = createMockFile('image/jpeg');
    expect(isValidImageFile(file)).toBe(true);
  });

  it('PNG ファイルは有効', () => {
    const file = createMockFile('image/png');
    expect(isValidImageFile(file)).toBe(true);
  });

  it('GIF ファイルは有効', () => {
    const file = createMockFile('image/gif');
    expect(isValidImageFile(file)).toBe(true);
  });

  it('WebP ファイルは有効', () => {
    const file = createMockFile('image/webp');
    expect(isValidImageFile(file)).toBe(true);
  });

  it('SVG ファイルは無効', () => {
    const file = createMockFile('image/svg+xml');
    expect(isValidImageFile(file)).toBe(false);
  });

  it('PDF ファイルは無効', () => {
    const file = createMockFile('application/pdf');
    expect(isValidImageFile(file)).toBe(false);
  });

  it('テキストファイルは無効', () => {
    const file = createMockFile('text/plain');
    expect(isValidImageFile(file)).toBe(false);
  });
});

describe('isValidImageSize', () => {
  it('20MB 未満のファイルは有効', () => {
    const file = createMockFile('image/png', 1024 * 1024); // 1MB
    expect(isValidImageSize(file)).toBe(true);
  });

  it('ちょうど 20MB のファイルは有効', () => {
    const file = createMockFile('image/png', MAX_IMAGE_SIZE);
    expect(isValidImageSize(file)).toBe(true);
  });

  it('20MB を超えるファイルは無効', () => {
    const file = createMockFile('image/png', MAX_IMAGE_SIZE + 1);
    expect(isValidImageSize(file)).toBe(false);
  });

  it('空のファイルは有効', () => {
    const file = createMockFile('image/png', 0);
    expect(isValidImageSize(file)).toBe(true);
  });
});

describe('encodeImageToWebP', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('画像を WebP Base64 形式にエンコードする', async () => {
    const file = createMockFile('image/png', 1024);
    const resultPromise = encodeImageToWebP(file);

    // Mock Image の onload を発火させる
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({
      type: 'base64',
      media_type: 'image/webp',
      data: 'mockBase64Data',
    });
  });

  it('オプションでリサイズ設定を指定できる', async () => {
    const file = createMockFile('image/png', 1024);
    const resultPromise = encodeImageToWebP(file, {
      maxWidth: 800,
      maxHeight: 600,
      quality: 0.9,
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.type).toBe('base64');
    expect(result.media_type).toBe('image/webp');
  });

  it('URL.createObjectURL と revokeObjectURL が呼ばれる', async () => {
    const file = createMockFile('image/png', 1024);
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

    const resultPromise = encodeImageToWebP(file);
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(createObjectURLSpy).toHaveBeenCalledWith(file);
    expect(revokeObjectURLSpy).toHaveBeenCalled();
  });
});
