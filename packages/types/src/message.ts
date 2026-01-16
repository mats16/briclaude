// =====================================================
// Message Content Block Types
// =====================================================

/**
 * テキストコンテンツブロック
 */
export interface TextContentBlock {
  type: 'text';
  text: string;
}

/**
 * ツール使用コンテンツブロック
 */
export interface ToolUseContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * ツール結果コンテンツブロック
 */
export interface ToolResultContentBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// =====================================================
// Image Content Block Types
// =====================================================

/**
 * Base64 エンコードされた画像ソース
 */
export interface Base64ImageSource {
  type: 'base64';
  media_type: 'image/webp' | 'image/png' | 'image/jpeg' | 'image/gif';
  data: string;
}

/**
 * 画像ソース型
 */
export type ImageSource = Base64ImageSource;

/**
 * 画像コンテンツブロック
 */
export interface ImageContentBlock {
  type: 'image';
  source: ImageSource;
}

/**
 * すべてのコンテンツブロック型のユニオン
 */
export type MessageContentBlock =
  | TextContentBlock
  | ImageContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock;

/**
 * ユーザーメッセージで使用可能なコンテンツブロック
 */
export type UserMessageContentBlock = TextContentBlock | ImageContentBlock | ToolResultContentBlock;

// =====================================================
// Message Types
// =====================================================

/**
 * ユーザーメッセージの構造
 */
export interface UserMessageContent {
  role: 'user';
  content: string | MessageContentBlock[];
}

/**
 * アシスタントメッセージの構造
 */
export interface AssistantMessageContent {
  role: 'assistant';
  content: MessageContentBlock[];
}

// =====================================================
// SDK Message Extended Types
// =====================================================

/**
 * user タイプの SDK メッセージ
 */
export interface SDKUserMessageEvent {
  type: 'user';
  uuid?: string;
  session_id?: string;
  parent_tool_use_id?: string | null;
  message: UserMessageContent;
  /** Skill実行時にシステムが自動生成したメッセージかどうか */
  isSynthetic?: boolean;
}

/**
 * assistant タイプの SDK メッセージ
 */
export interface SDKAssistantMessageEvent {
  type: 'assistant';
  uuid?: string;
  session_id?: string;
  parent_tool_use_id?: string | null;
  message: AssistantMessageContent;
}

/**
 * system タイプの SDK メッセージ
 */
export interface SDKSystemMessageEvent {
  type: 'system';
  subtype?: 'init' | string;
  model?: string;
}

/**
 * result タイプの SDK メッセージ
 */
export interface SDKResultMessageEvent {
  type: 'result';
}

/**
 * stream_event タイプの SDK メッセージ
 */
export interface SDKStreamMessageEvent {
  type: 'stream_event';
}

// =====================================================
// Type Guards
// =====================================================

/**
 * TextContentBlock の型ガード
 */
export function isTextContentBlock(block: unknown): block is TextContentBlock {
  if (typeof block !== 'object' || block === null) return false;
  const b = block as Record<string, unknown>;
  return b.type === 'text' && typeof b.text === 'string';
}

/**
 * ToolUseContentBlock の型ガード
 */
export function isToolUseContentBlock(block: unknown): block is ToolUseContentBlock {
  if (typeof block !== 'object' || block === null) return false;
  const b = block as Record<string, unknown>;
  return (
    b.type === 'tool_use' &&
    typeof b.id === 'string' &&
    typeof b.name === 'string' &&
    typeof b.input === 'object' &&
    b.input !== null
  );
}

/**
 * ToolResultContentBlock の型ガード
 */
export function isToolResultContentBlock(block: unknown): block is ToolResultContentBlock {
  if (typeof block !== 'object' || block === null) return false;
  const b = block as Record<string, unknown>;
  return b.type === 'tool_result' && typeof b.tool_use_id === 'string';
}

/**
 * ImageContentBlock の型ガード
 */
export function isImageContentBlock(block: unknown): block is ImageContentBlock {
  if (typeof block !== 'object' || block === null) return false;
  const b = block as Record<string, unknown>;
  return (
    b.type === 'image' &&
    typeof b.source === 'object' &&
    b.source !== null &&
    (b.source as Record<string, unknown>).type === 'base64'
  );
}

/**
 * SDKUserMessageEvent の型ガード
 */
export function isSDKUserMessageEvent(event: unknown): event is SDKUserMessageEvent {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  return e.type === 'user' && typeof e.message === 'object' && e.message !== null;
}

/**
 * SDKAssistantMessageEvent の型ガード
 */
export function isSDKAssistantMessageEvent(event: unknown): event is SDKAssistantMessageEvent {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  return e.type === 'assistant' && typeof e.message === 'object' && e.message !== null;
}

/**
 * SDKSystemMessageEvent の型ガード
 */
export function isSDKSystemMessageEvent(event: unknown): event is SDKSystemMessageEvent {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  return e.type === 'system';
}

/**
 * parent_tool_use_id を持つイベントかどうか
 */
export function hasParentToolUseId(event: unknown): event is { parent_tool_use_id: string } {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  return typeof e.parent_tool_use_id === 'string' && e.parent_tool_use_id !== null;
}
