import { vi } from 'vitest';
import '@testing-library/dom';

// Mock URL.createObjectURL and revokeObjectURL
globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
globalThis.URL.revokeObjectURL = vi.fn();

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-1234',
  },
});

// Mock Image
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  width = 100;
  height = 100;

  constructor() {
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
}

(globalThis as typeof globalThis & { Image: typeof Image }).Image =
  MockImage as unknown as typeof Image;

// Mock canvas
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  drawImage: vi.fn(),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/webp;base64,mockBase64Data');

// Mock DataTransfer
class MockDataTransfer {
  items: DataTransferItem[] = [];
  files: FileList = [] as unknown as FileList;
  private _files: File[] = [];

  constructor() {
    this.items = {
      add: (file: File) => {
        this._files.push(file);
      },
      length: 0,
    } as unknown as DataTransferItem[];

    // Update files getter to return actual files
    Object.defineProperty(this, 'files', {
      get: () => this.createFileList(),
    });
  }

  private createFileList(): FileList {
    const files = this._files;
    const fileList = {
      length: files.length,
      item: (index: number) => files[index] || null,
      [Symbol.iterator]: function* () {
        yield* files;
      },
    } as unknown as FileList;

    // Add numeric indices
    files.forEach((file, index) => {
      (fileList as unknown as Record<number, File>)[index] = file;
    });

    return fileList;
  }
}

(globalThis as typeof globalThis & { DataTransfer: typeof DataTransfer }).DataTransfer =
  MockDataTransfer as unknown as typeof DataTransfer;
