import { describe, it, expect } from 'vitest';
import {
  buildMessageContent,
  extractTextFromContent,
  hasImageContent,
  extractImageBlocks,
  type AttachedImage,
} from './content-builder';
import type { Base64ImageSource, ImageContentBlock, TextContentBlock } from '@repo/types';

// Helper to create mock AttachedImage
function createMockImage(id: string, data: string = 'base64data'): AttachedImage {
  const encoded: Base64ImageSource = {
    type: 'base64',
    media_type: 'image/webp',
    data,
  };
  return {
    id,
    file: new File([''], 'test.png', { type: 'image/png' }),
    preview: 'blob:preview-url',
    encoded,
  };
}

describe('buildMessageContent', () => {
  it('テキストのみの場合、テキストブロックを含む配列を返す', () => {
    const result = buildMessageContent('Hello, world!', []);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'text',
      text: 'Hello, world!',
    });
  });

  it('画像のみの場合、画像ブロックを含む配列を返す', () => {
    const images = [createMockImage('img1', 'data1')];
    const result = buildMessageContent('', images);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/webp',
        data: 'data1',
      },
    });
  });

  it('テキストと画像の両方がある場合、画像が先頭に配置される', () => {
    const images = [createMockImage('img1', 'data1')];
    const result = buildMessageContent('Hello!', images);

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('image');
    expect(result[1].type).toBe('text');
  });

  it('複数の画像がある場合、すべて先頭に配置される', () => {
    const images = [
      createMockImage('img1', 'data1'),
      createMockImage('img2', 'data2'),
      createMockImage('img3', 'data3'),
    ];
    const result = buildMessageContent('Hello!', images);

    expect(result).toHaveLength(4);
    expect(result[0].type).toBe('image');
    expect(result[1].type).toBe('image');
    expect(result[2].type).toBe('image');
    expect(result[3].type).toBe('text');
  });

  it('空白のみのテキストは無視される', () => {
    const images = [createMockImage('img1')];
    const result = buildMessageContent('   ', images);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('image');
  });

  it('テキストの前後の空白はトリムされる', () => {
    const result = buildMessageContent('  Hello, world!  ', []);

    expect(result).toHaveLength(1);
    expect((result[0] as TextContentBlock).text).toBe('Hello, world!');
  });
});

describe('extractTextFromContent', () => {
  it('文字列が渡された場合、そのまま返す', () => {
    const result = extractTextFromContent('Hello, world!');
    expect(result).toBe('Hello, world!');
  });

  it('配列からテキストブロックを抽出して結合する', () => {
    const content = [
      { type: 'text', text: 'Hello' } as TextContentBlock,
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/webp', data: 'x' },
      } as ImageContentBlock,
      { type: 'text', text: 'World' } as TextContentBlock,
    ];
    const result = extractTextFromContent(content);
    expect(result).toBe('Hello\nWorld');
  });

  it('画像のみの配列の場合、空文字列を返す', () => {
    const content = [
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/webp', data: 'x' },
      } as ImageContentBlock,
    ];
    const result = extractTextFromContent(content);
    expect(result).toBe('');
  });

  it('空の配列の場合、空文字列を返す', () => {
    const result = extractTextFromContent([]);
    expect(result).toBe('');
  });
});

describe('hasImageContent', () => {
  it('文字列の場合、falseを返す', () => {
    expect(hasImageContent('Hello')).toBe(false);
  });

  it('画像ブロックを含む配列の場合、trueを返す', () => {
    const content = [
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/webp', data: 'x' },
      } as ImageContentBlock,
    ];
    expect(hasImageContent(content)).toBe(true);
  });

  it('テキストブロックのみの配列の場合、falseを返す', () => {
    const content = [{ type: 'text', text: 'Hello' } as TextContentBlock];
    expect(hasImageContent(content)).toBe(false);
  });

  it('空の配列の場合、falseを返す', () => {
    expect(hasImageContent([])).toBe(false);
  });
});

describe('extractImageBlocks', () => {
  it('文字列の場合、空の配列を返す', () => {
    const result = extractImageBlocks('Hello');
    expect(result).toEqual([]);
  });

  it('画像ブロックを抽出して返す', () => {
    const imageBlock: ImageContentBlock = {
      type: 'image',
      source: { type: 'base64', media_type: 'image/webp', data: 'data1' },
    };
    const content = [
      { type: 'text', text: 'Hello' } as TextContentBlock,
      imageBlock,
      { type: 'text', text: 'World' } as TextContentBlock,
    ];
    const result = extractImageBlocks(content);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(imageBlock);
  });

  it('複数の画像ブロックを抽出する', () => {
    const content = [
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/webp', data: 'data1' },
      } as ImageContentBlock,
      { type: 'text', text: 'Hello' } as TextContentBlock,
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/webp', data: 'data2' },
      } as ImageContentBlock,
    ];
    const result = extractImageBlocks(content);
    expect(result).toHaveLength(2);
  });

  it('画像がない場合、空の配列を返す', () => {
    const content = [{ type: 'text', text: 'Hello' } as TextContentBlock];
    const result = extractImageBlocks(content);
    expect(result).toEqual([]);
  });
});
