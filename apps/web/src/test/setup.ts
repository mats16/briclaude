import { vi } from 'vitest';
import '@testing-library/dom';

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
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

global.Image = MockImage as unknown as typeof Image;

// Mock canvas
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  drawImage: vi.fn(),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/webp;base64,mockBase64Data');

// Mock DataTransfer
class MockDataTransfer {
  items: DataTransferItem[] = [];
  files: FileList;
  private _files: File[] = [];

  constructor() {
    this.items = {
      add: (file: File) => {
        this._files.push(file);
      },
      length: 0,
    } as unknown as DataTransferItem[];

    this.files = {
      length: 0,
      item: (index: number) => this._files[index] || null,
      [Symbol.iterator]: function* () {
        for (const file of []) yield file;
      },
    } as unknown as FileList;

    // Update files getter to return actual files
    Object.defineProperty(this, 'files', {
      get: () => {
        const fileList = {
          length: this._files.length,
          item: (index: number) => this._files[index] || null,
          [Symbol.iterator]: function* () {
            for (const file of this._files) yield file;
          },
        } as unknown as FileList;

        // Add numeric indices
        this._files.forEach((file, index) => {
          (fileList as unknown as Record<number, File>)[index] = file;
        });

        return fileList;
      },
    });
  }
}

global.DataTransfer = MockDataTransfer as unknown as typeof DataTransfer;
