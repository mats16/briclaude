// apps/backend/src/db/schema.ts
import {
  pgTable,
  uuid,
  timestamp,
  text,
  boolean,
  integer,
  index,
  primaryKey,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// =====================================================
// Enums
// =====================================================

export const claudeConfigBackupEnum = pgEnum('claude_config_backup', ['auto', 'disabled']);

// =====================================================
// Tables
// =====================================================

/**
 * users テーブル
 * ユーザーの基本情報を管理
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
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
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  claudeConfigBackup: claudeConfigBackupEnum('claude_config_backup').notNull().default('auto'),
  createdAt: timestamp('created_at', { mode: 'date' })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date()),
});

/**
 * oauth_tokens テーブル
 * OAuth認証トークンを管理
 */
export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    authType: text('auth_type').notNull(),
    provider: text('provider').notNull(),
    token: text('token').notNull(),
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
    // 複合主キー
    pk: primaryKey({ columns: [table.userId, table.authType, table.provider] }),
    // userIdインデックス
    userIdIdx: index('oauth_tokens_user_id_idx').on(table.userId),
  })
);

/**
 * sessions テーブル
 * セッション情報を管理
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at', { mode: 'date' })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date()),
  },
  table => ({
    // userIdインデックス
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
  })
);

/**
 * session_events テーブル
 * セッションイベントを時系列で管理
 */
export const sessionEvents = pgTable(
  'session_events',
  {
    uuid: uuid('uuid').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    type: text('type').notNull(),
    subtype: text('subtype'),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date()),
  },
  table => ({
    // (session_id, seq) 複合インデックス（昇順取得用）
    sessionSeqIdx: index('session_events_session_id_seq_idx').on(table.sessionId, table.seq),
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
