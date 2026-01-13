// apps/api/src/db/schema.ts
import {
  pgTable,
  uuid,
  timestamp,
  text,
  index,
  primaryKey,
  customType,
  pgPolicy,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { encrypt, decrypt } from '../utils/encryption.js';

// =====================================================
// Custom Types
// =====================================================

/**
 * 暗号化テキスト型
 * データベースには暗号化された文字列として保存され、
 * アプリケーションでは自動的に復号化されます。
 * 使用時に .notNull() を付けて NOT NULL 制約を追加できます。
 */
const encryptedText = customType<{ data: string; notNull: false; default: false }>({
  dataType() {
    return 'text';
  },
  toDriver(value: string): string {
    return encrypt(value);
  },
  fromDriver(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error('Expected string from database');
    }
    return decrypt(value);
  },
});

/**
 * 暗号化テキスト型（NULLABLE）
 * データベースには暗号化された文字列として保存され、
 * アプリケーションでは自動的に復号化されます。
 * NULL値も適切にハンドリングされます。
 */
const encryptedTextNullable = customType<{ data: string | null; notNull: false; default: false }>({
  dataType() {
    return 'text';
  },
  toDriver(value: string | null): string | null {
    if (value === null) return null;
    return encrypt(value);
  },
  fromDriver(value: unknown): string | null {
    if (value === null) return null;
    if (typeof value !== 'string') {
      throw new Error('Expected string or null from database');
    }
    return decrypt(value);
  },
});

// =====================================================
// Enums
// =====================================================
// (No enums defined)

// =====================================================
// Tables
// =====================================================

/**
 * users テーブル
 * ユーザーの基本情報を管理
 */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { mode: 'date' })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date()),
});

/**
 * user_settings テーブル
 * ユーザーごとの設定を管理
 */
export const userSettings = pgTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  claudeConfigBackup: text('claude_config_backup').notNull().default('auto'),
  createdAt: timestamp('created_at', { mode: 'date' })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date()),
}).enableRLS();

/**
 * user_settings の RLS ポリシー
 * ユーザーは自分のデータのみアクセス可能
 */
export const userSettingsPolicy = pgPolicy('user_settings_user_isolation_policy', {
  for: 'all',
  to: 'public',
  using: sql`user_id = current_setting('app.user_id', true)`,
  withCheck: sql`user_id = current_setting('app.user_id', true)`,
}).link(userSettings);

/**
 * oauth_tokens テーブル
 * OAuth認証トークンを管理
 * 複合主キー: (user_id, provider, auth_type)
 */
export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    authType: text('auth_type').notNull(),
    accessToken: encryptedText('access_token').notNull(),
    refreshToken: encryptedTextNullable('refresh_token'),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date' })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date()),
  },
  table => ({
    // 複合主キー: (user_id, provider, auth_type)
    pk: primaryKey({ columns: [table.userId, table.provider, table.authType] }),
    // user_id インデックス（RLSクエリ高速化）
    userIdIdx: index('oauth_tokens_user_id_idx').on(table.userId),
  })
).enableRLS();

/**
 * oauth_tokens の RLS ポリシー
 * ユーザーは自分のトークンのみアクセス可能
 */
export const oauthTokensPolicy = pgPolicy('oauth_tokens_user_isolation_policy', {
  for: 'all',
  to: 'public',
  using: sql`user_id = current_setting('app.user_id', true)`,
  withCheck: sql`user_id = current_setting('app.user_id', true)`,
}).link(oauthTokens);

/**
 * sessions テーブル
 * セッション情報を管理
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title'),
    status: text('status').notNull().default('init'), // 'init' | 'running' | 'idle' | 'error' | 'archived'
    sdkSessionId: uuid('sdk_session_id'),
    context: jsonb('context'), // SessionContextResponse
    createdAt: timestamp('created_at', { mode: 'date' })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date()),
  },
  table => ({
    // user_id インデックス（RLSクエリ高速化）
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    // updated_at インデックス（ソート用）
    updatedAtIdx: index('sessions_updated_at_idx').on(table.updatedAt),
    // status インデックス（フィルタリング用）
    statusIdx: index('sessions_status_idx').on(table.status),
    // アクティブセッション用部分インデックス（status != 'archived' のみ）
    activeSessionsIdx: index('sessions_active_idx')
      .on(table.userId, table.updatedAt)
      .where(sql`status != 'archived'`),
  })
).enableRLS();

/**
 * sessions の RLS ポリシー
 * ユーザーは自分のセッションのみアクセス可能
 */
export const sessionsPolicy = pgPolicy('sessions_user_isolation_policy', {
  for: 'all',
  to: 'public',
  using: sql`user_id = current_setting('app.user_id', true)`,
  withCheck: sql`user_id = current_setting('app.user_id', true)`,
}).link(sessions);

/**
 * session_events テーブル
 * セッションイベントを時系列で管理
 *
 * 主キー: uuid
 * 順序: created_at でソート
 */
export const sessionEvents = pgTable(
  'session_events',
  {
    uuid: uuid('uuid').primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    subtype: text('subtype'),
    message: jsonb('message').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  table => ({
    // (session_id, created_at) インデックス - 時系列クエリ用
    sessionCreatedAtIdx: index('session_events_session_created_at_idx').on(
      table.sessionId,
      table.createdAt
    ),
  })
);

// =====================================================
// Type Exports
// =====================================================

// Insert types (for creating new records)
export type InsertUser = typeof users.$inferInsert;
export type InsertUserSettings = typeof userSettings.$inferInsert;
export type InsertOauthToken = typeof oauthTokens.$inferInsert;
export type InsertSession = typeof sessions.$inferInsert;
export type InsertSessionEvent = typeof sessionEvents.$inferInsert;

// Select types (for querying records)
export type User = typeof users.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type OauthToken = typeof oauthTokens.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SessionEvent = typeof sessionEvents.$inferSelect;
