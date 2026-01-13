// apps/api/src/models/session.model.ts
/**
 * @fileoverview セッション関連のドメインモデル
 *
 * ## 設計意図
 *
 * ### なぜ SessionId クラスを TypeID<'session'> を継承して実装したか
 *
 * 1. **TypeID の再利用**: typeid-js ライブラリの TypeID クラスを継承し、
 *    全メソッドをそのまま利用可能。
 *
 * 2. **プレフィックスの省略**: ファクトリメソッドでプレフィックス指定を省略し、
 *    タイポのリスクを削減。
 *
 * 3. **型安全性**: `SessionId extends TypeID<'session'>` により、
 *    他のプレフィックスを持つ TypeID と型レベルで区別可能。
 *
 * 4. **UUIDv7 の活用**: TypeID は内部で UUIDv7 を使用しており、
 *    時系列ソートが可能でインデックス効率が良い。
 *
 * ### ID 形式の使い分け
 *
 * | 用途 | 形式 | 例 |
 * |------|------|-----|
 * | API リクエスト/レスポンス | TypeID | session_01h455vb4pex5vsknk084sn02q |
 * | ファイルシステム（cwd） | TypeID | /home/user/session_01h455vb... |
 * | データベース | UUID | 0188a5eb-4b84-7095-bae8-084200ae0295 |
 * | WebSocket ルーム ID | TypeID | session_01h455vb4pex5vsknk084sn02q |
 *
 * ### 使用例
 *
 * ```typescript
 * import { SessionId } from './models/session.model.js';
 *
 * // 新規セッション作成時
 * const sessionId = new SessionId();
 * await db.insert(sessions).values({ id: sessionId.toUUID() });
 * return { id: sessionId.toString() }; // API レスポンス
 *
 * // API から受け取った TypeID を処理
 * const sessionId = SessionId.fromString(request.params.session_id);
 * await db.select().from(sessions).where(eq(sessions.id, sessionId.toUUID()));
 *
 * // DB から取得した UUID を API レスポンスに変換
 * const sessionId = SessionId.fromUUID(row.id);
 * return { id: sessionId.toString() };
 * ```
 */

import { TypeID } from 'typeid-js';

const SESSION_PREFIX = 'session' as const;

/**
 * セッション ID クラス（TypeID<'session'> を継承）
 *
 * TypeID の全メソッドが利用可能:
 * - toString(): TypeID 文字列（例: "session_01h455vb..."）
 * - toUUID(): UUID 文字列（例: "0188a5eb-4b84-..."）
 * - getType(): プレフィックス（"session"）
 * - getSuffix(): サフィックス（base32 部分）
 * - toUUIDBytes(): UUID バイト配列
 *
 * プレフィックス省略ファクトリメソッド:
 * - SessionId.fromUUID(uuid)
 * - SessionId.fromString(typeIdStr)
 * - SessionId.fromUUIDBytes(bytes)
 */
// @ts-expect-error - SessionId の静的メソッドは固定プレフィックス 'session' を使用するため、
// TypeID のジェネリック静的メソッドと厳密な互換性がないが、実行時には問題ない
export class SessionId extends TypeID<typeof SESSION_PREFIX> {
  /** 新しい SessionId を生成（UUIDv7 ベース） */
  constructor() {
    super(SESSION_PREFIX);
  }

  /** UUID 文字列から SessionId を作成 */
  static fromUUID(uuid: string): SessionId {
    const tid = TypeID.fromUUID(SESSION_PREFIX, uuid);
    return Object.assign(Object.create(SessionId.prototype), tid) as SessionId;
  }

  /** TypeID 文字列（session_xxx）から SessionId を作成 */
  static fromString(str: string): SessionId {
    const tid = TypeID.fromString(str, SESSION_PREFIX);
    return Object.assign(Object.create(SessionId.prototype), tid) as SessionId;
  }

  /** UUID バイト配列から SessionId を作成 */
  static fromUUIDBytes(bytes: Uint8Array): SessionId {
    const tid = TypeID.fromUUIDBytes(SESSION_PREFIX, bytes);
    return Object.assign(Object.create(SessionId.prototype), tid) as SessionId;
  }
}
