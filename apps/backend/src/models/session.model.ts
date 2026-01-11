// apps/backend/src/models/session.model.ts
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
