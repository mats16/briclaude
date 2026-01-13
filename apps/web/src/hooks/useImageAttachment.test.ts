import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useImageAttachment } from './useImageAttachment';
import * as imageUtils from '@/lib/image-utils';
import type { Base64ImageSource } from '@repo/types';

// Mock image-utils
vi.mock('@/lib/image-utils', async () => {
  const actual = await vi.importActual('@/lib/image-utils');
  return {
    ...actual,
    encodeImageToWebP: vi.fn().mockResolvedValue({
      type: 'base64',
      media_type: 'image/webp',
      data: 'mockBase64Data',
    }),
    isValidImageFile: vi.fn().mockReturnValue(true),
    isValidImageSize: vi.fn().mockReturnValue(true),
  };
});

// Helper to create mock FileList
function createMockFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    [Symbol.iterator]: function* () {
      for (const file of files) yield file;
    },
  } as unknown as FileList;

  files.forEach((file, index) => {
    (fileList as unknown as Record<number, File>)[index] = file;
  });

  return fileList;
}

// Helper to create mock File
function createMockFile(name: string, type: string = 'image/png'): File {
  return new File(['test'], name, { type });
}

describe('useImageAttachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(imageUtils.isValidImageFile).mockReturnValue(true);
    vi.mocked(imageUtils.isValidImageSize).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('初期状態では画像が空', () => {
    const { result } = renderHook(() => useImageAttachment());

    expect(result.current.images).toEqual([]);
    expect(result.current.hasImages).toBe(false);
    expect(result.current.isProcessing).toBe(false);
  });

  it('addImages で画像を追加できる', async () => {
    const { result } = renderHook(() => useImageAttachment());

    const files = createMockFileList([createMockFile('test1.png')]);

    await act(async () => {
      await result.current.addImages(files);
    });

    await waitFor(() => {
      expect(result.current.images).toHaveLength(1);
      expect(result.current.hasImages).toBe(true);
    });
  });

  it('複数の画像を追加できる', async () => {
    const { result } = renderHook(() => useImageAttachment());

    const files = createMockFileList([createMockFile('test1.png'), createMockFile('test2.png')]);

    await act(async () => {
      await result.current.addImages(files);
    });

    await waitFor(() => {
      expect(result.current.images).toHaveLength(2);
    });
  });

  it('removeImage で画像を削除できる', async () => {
    const { result } = renderHook(() => useImageAttachment());

    const files = createMockFileList([createMockFile('test1.png')]);

    await act(async () => {
      await result.current.addImages(files);
    });

    await waitFor(() => {
      expect(result.current.images).toHaveLength(1);
    });

    const imageId = result.current.images[0].id;

    act(() => {
      result.current.removeImage(imageId);
    });

    expect(result.current.images).toHaveLength(0);
    expect(result.current.hasImages).toBe(false);
  });

  it('clearImages ですべての画像をクリアできる', async () => {
    const { result } = renderHook(() => useImageAttachment());

    const files = createMockFileList([createMockFile('test1.png'), createMockFile('test2.png')]);

    await act(async () => {
      await result.current.addImages(files);
    });

    await waitFor(() => {
      expect(result.current.images).toHaveLength(2);
    });

    act(() => {
      result.current.clearImages();
    });

    expect(result.current.images).toHaveLength(0);
    expect(result.current.hasImages).toBe(false);
  });

  it('最大画像数を超える場合は追加されない', async () => {
    const { result } = renderHook(() => useImageAttachment({ maxImages: 2 }));

    const files = createMockFileList([
      createMockFile('test1.png'),
      createMockFile('test2.png'),
      createMockFile('test3.png'),
    ]);

    await act(async () => {
      await result.current.addImages(files);
    });

    await waitFor(() => {
      expect(result.current.images).toHaveLength(2);
    });
  });

  it('すでに最大数に達している場合は追加されない', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useImageAttachment({ maxImages: 1, onError }));

    const files1 = createMockFileList([createMockFile('test1.png')]);

    await act(async () => {
      await result.current.addImages(files1);
    });

    await waitFor(() => {
      expect(result.current.images).toHaveLength(1);
    });

    const files2 = createMockFileList([createMockFile('test2.png')]);

    await act(async () => {
      await result.current.addImages(files2);
    });

    expect(result.current.images).toHaveLength(1);
    expect(onError).toHaveBeenCalled();
  });

  it('無効なファイル形式の場合は onError が呼ばれる', async () => {
    vi.mocked(imageUtils.isValidImageFile).mockReturnValue(false);
    const onError = vi.fn();
    const { result } = renderHook(() => useImageAttachment({ onError }));

    const files = createMockFileList([createMockFile('test.txt', 'text/plain')]);

    await act(async () => {
      await result.current.addImages(files);
    });

    expect(onError).toHaveBeenCalled();
    expect(result.current.images).toHaveLength(0);
  });

  it('ファイルサイズが大きすぎる場合は onError が呼ばれる', async () => {
    vi.mocked(imageUtils.isValidImageSize).mockReturnValue(false);
    const onError = vi.fn();
    const { result } = renderHook(() => useImageAttachment({ onError }));

    const files = createMockFileList([createMockFile('large.png')]);

    await act(async () => {
      await result.current.addImages(files);
    });

    expect(onError).toHaveBeenCalled();
    expect(result.current.images).toHaveLength(0);
  });

  it('画像処理中は isProcessing が true になる', async () => {
    // encodeImageToWebP を遅延させる
    let resolveEncode: ((value: Base64ImageSource) => void) | undefined;
    vi.mocked(imageUtils.encodeImageToWebP).mockImplementation(
      () =>
        new Promise<Base64ImageSource>(resolve => {
          resolveEncode = resolve;
        })
    );

    const { result } = renderHook(() => useImageAttachment());

    const files = createMockFileList([createMockFile('test.png')]);

    act(() => {
      result.current.addImages(files);
    });

    // 処理中は isProcessing が true
    expect(result.current.isProcessing).toBe(true);

    // 処理完了
    await act(async () => {
      resolveEncode!({
        type: 'base64',
        media_type: 'image/webp',
        data: 'mockBase64Data',
      });
    });

    await waitFor(() => {
      expect(result.current.isProcessing).toBe(false);
    });
  });
});
