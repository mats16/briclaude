// apps/backend/src/models/session.model.ts
/**
 * @fileoverview セッション関連のドメインモデル
 *
 * ## 設計意図
 *
 * ### なぜ SessionId Value Object を導入したか
 *
 * 1. **ID 形式の分離**: データベースでは UUID を使用し、API やファイルシステムでは
 *    TypeID（session_xxx 形式）を使用する。この変換ロジックを一箇所にカプセル化。
 *
 * 2. **型安全性**: TypeID 文字列と UUID 文字列を型レベルで区別し、
 *    誤った形式の ID を渡すバグを防止。
 *
 * 3. **UUIDv7 の活用**: TypeID は内部で UUIDv7 を使用しており、
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
 * // 新規セッション作成時
 * const sessionId = new SessionId();
 * await db.insert(sessions).values({ id: sessionId.toUUID() });
 * return { id: sessionId.toString() }; // API レスポンス
 *
 * // API から受け取った TypeID を処理
 * const sessionId = SessionId.fromTypeId(request.params.session_id);
 * await db.select().from(sessions).where(eq(sessions.id, sessionId.toUUID()));
 *
 * // DB から取得した UUID を API レスポンスに変換
 * const sessionId = SessionId.fromUUID(row.id);
 * return { id: sessionId.toString() };
 * ```
 */

import { typeid, TypeID } from 'typeid-js';

const SESSION_PREFIX = 'session';

/**
 * セッションIDを表すValue Object
 *
 * - TypeID 形式（session_xxx）と UUID 形式の相互変換を提供
 * - 内部で TypeID オブジェクトを保持し、TypeID の機能を委譲
 */
export class SessionId {
  private readonly tid: TypeID<typeof SESSION_PREFIX>;

  /** 新しい SessionId を生成（UUIDv7 ベース） */
  constructor() {
    this.tid = typeid(SESSION_PREFIX);
  }

  /** TypeID オブジェクトから SessionId を作成（内部用） */
  private static fromTid(tid: TypeID<typeof SESSION_PREFIX>): SessionId {
    const instance = Object.create(SessionId.prototype) as SessionId;
    Object.defineProperty(instance, 'tid', { value: tid, writable: false });
    return instance;
  }

  /** UUID 文字列から SessionId を作成 */
  static fromUUID(uuid: string): SessionId {
    const tid = TypeID.fromUUID(SESSION_PREFIX, uuid);
    return SessionId.fromTid(tid);
  }

  /** TypeID 文字列（session_xxx）から SessionId を作成 */
  static fromTypeId(typeIdStr: string): SessionId {
    const tid = TypeID.fromString(typeIdStr, SESSION_PREFIX);
    return SessionId.fromTid(tid);
  }

  /** UUID 文字列を取得（DB 保存用） */
  toUUID(): string {
    return this.tid.toUUID();
  }

  /** TypeID 文字列を取得（API レスポンス・cwd 用） */
  toString(): string {
    return this.tid.toString();
  }

  /** プレフィックスを取得 */
  getType(): typeof SESSION_PREFIX {
    return this.tid.getType();
  }

  /** サフィックス（base32 エンコード部分）を取得 */
  getSuffix(): string {
    return this.tid.getSuffix();
  }

  /** UUID バイト列を取得 */
  toUUIDBytes(): Uint8Array {
    return this.tid.toUUIDBytes();
  }
}
