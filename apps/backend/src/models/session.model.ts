// apps/backend/src/models/session.model.ts
/**
 * @fileoverview セッション関連のドメインモデル
 *
 * ## 設計意図
 *
 * ### なぜ SessionId を TypeID<'session'> として定義したか
 *
 * 1. **TypeID の再利用**: typeid-js ライブラリの TypeID クラスをそのまま活用。
 *
 * 2. **ID 形式の分離**: データベースでは UUID を使用し、API やファイルシステムでは
 *    TypeID（session_xxx 形式）を使用する。この変換は TypeID のメソッドで対応。
 *
 * 3. **型安全性**: `TypeID<'session'>` により、他のプレフィックスを持つ TypeID と
 *    型レベルで区別可能。
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
 * import { typeid, TypeID } from 'typeid-js';
 * import type { SessionId } from './models/session.model.js';
 *
 * // 新規セッション作成時
 * const sessionId: SessionId = typeid('session');
 * await db.insert(sessions).values({ id: sessionId.toUUID() });
 * return { id: sessionId.toString() }; // API レスポンス
 *
 * // API から受け取った TypeID を処理
 * const sessionId: SessionId = TypeID.fromString(request.params.session_id, 'session');
 * await db.select().from(sessions).where(eq(sessions.id, sessionId.toUUID()));
 *
 * // DB から取得した UUID を API レスポンスに変換
 * const sessionId: SessionId = TypeID.fromUUID('session', row.id);
 * return { id: sessionId.toString() };
 * ```
 *
 * ### SessionId が持つメソッド（TypeID から継承）
 *
 * - `toString()`: TypeID 文字列を取得（例: "session_01h455vb..."）
 * - `toUUID()`: UUID 文字列を取得（例: "0188a5eb-4b84-..."）
 * - `getType()`: プレフィックスを取得（"session"）
 * - `getSuffix()`: サフィックス（base32 部分）を取得
 * - `toUUIDBytes()`: UUID のバイト配列を取得
 */

import type { TypeID } from 'typeid-js';

/**
 * セッション ID の型（TypeID<'session'> のエイリアス）
 *
 * TypeID の全メソッドが利用可能:
 * - toString(): TypeID 文字列
 * - toUUID(): UUID 文字列
 * - getType(): プレフィックス
 * - getSuffix(): サフィックス
 * - toUUIDBytes(): UUID バイト配列
 */
export type SessionId = TypeID<'session'>;
