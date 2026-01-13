import type {
  TextContentBlock,
  ImageContentBlock,
  UserMessageContentBlock,
  Base64ImageSource,
} from '@repo/types';

/**
 * 添付画像の情報
 */
export interface AttachedImage {
  id: string;
  file: File;
  preview: string; // プレビュー用 Data URL
  encoded: Base64ImageSource;
}

/**
 * テキストと画像から構造化メッセージコンテンツを構築
 * - テキストのみの場合でも配列形式を使用（APIの一貫性のため）
 * - 画像は先頭に配置（Claude は画像を先に処理）
 */
export function buildMessageContent(
  text: string,
  images: AttachedImage[]
): UserMessageContentBlock[] {
  const content: UserMessageContentBlock[] = [];

  // 画像を先頭に追加
  for (const img of images) {
    content.push({
      type: 'image',
      source: img.encoded,
    } as ImageContentBlock);
  }

  // テキストを追加
  if (text.trim()) {
    content.push({
      type: 'text',
      text: text.trim(),
    } as TextContentBlock);
  }

  return content;
}

/**
 * 構造化コンテンツからテキストを抽出
 * - プレビュー表示用
 */
export function extractTextFromContent(content: string | UserMessageContentBlock[]): string {
  if (typeof content === 'string') return content;

  return content
    .filter((block): block is TextContentBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n');
}

/**
 * コンテンツに画像が含まれているかチェック
 */
export function hasImageContent(content: string | UserMessageContentBlock[]): boolean {
  if (typeof content === 'string') return false;

  return content.some(block => block.type === 'image');
}

/**
 * コンテンツから画像ブロックを抽出
 */
export function extractImageBlocks(
  content: string | UserMessageContentBlock[]
): ImageContentBlock[] {
  if (typeof content === 'string') return [];

  return content.filter((block): block is ImageContentBlock => block.type === 'image');
}
