// apps/backend/src/db/helpers.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { insertSessionEvent } from './helpers.js';
import * as schema from './schema.js';
import { users, sessions, sessionEvents } from './schema.js';

describe('Database Helpers', () => {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle({ client, schema });

  let testUserId: string;
  let testSessionId: string;

  beforeAll(async () => {
    // テスト用のユーザーとセッションを作成
    const [user] = await db.insert(users).values({}).returning();
    testUserId = user.id;

    const [session] = await db
      .insert(sessions)
      .values({
        userId: testUserId,
        title: 'Test Session',
      })
      .returning();
    testSessionId = session.id;
  });

  afterAll(async () => {
    // テストデータをクリーンアップ
    await db.delete(sessionEvents);
    await db.delete(sessions);
    await db.delete(users);
    await client.end();
  });

  beforeEach(async () => {
    // 各テスト前に session_events をクリア
    await db.delete(sessionEvents);
  });

  describe('insertSessionEvent', () => {
    it('should auto-increment seq starting from 1', async () => {
      const event1 = await insertSessionEvent(db, {
        sessionId: testSessionId,
        type: 'test',
        message: 'First event',
      });

      expect(event1.seq).toBe(1);

      const event2 = await insertSessionEvent(db, {
        sessionId: testSessionId,
        type: 'test',
        message: 'Second event',
      });

      expect(event2.seq).toBe(2);

      const event3 = await insertSessionEvent(db, {
        sessionId: testSessionId,
        type: 'test',
        message: 'Third event',
      });

      expect(event3.seq).toBe(3);
    });

    it('should increment seq independently per session_id', async () => {
      // 別のセッションを作成
      const [session2] = await db
        .insert(sessions)
        .values({
          userId: testUserId,
          title: 'Test Session 2',
        })
        .returning();

      const event1Session1 = await insertSessionEvent(db, {
        sessionId: testSessionId,
        type: 'test',
        message: 'Session 1 - Event 1',
      });

      const event1Session2 = await insertSessionEvent(db, {
        sessionId: session2.id,
        type: 'test',
        message: 'Session 2 - Event 1',
      });

      const event2Session1 = await insertSessionEvent(db, {
        sessionId: testSessionId,
        type: 'test',
        message: 'Session 1 - Event 2',
      });

      expect(event1Session1.seq).toBe(1);
      expect(event1Session2.seq).toBe(1); // 独立してカウント
      expect(event2Session1.seq).toBe(2);

      // クリーンアップ
      await db.delete(sessions).where(eq(sessions.id, session2.id));
    });

    it('should use provided seq if specified', async () => {
      const event = await insertSessionEvent(db, {
        sessionId: testSessionId,
        type: 'test',
        message: 'Event with custom seq',
        seq: 10,
      });

      expect(event.seq).toBe(10);
    });

    it('should handle concurrent inserts correctly', async () => {
      // 複数のイベントを並行挿入
      const promises = Array.from({ length: 5 }, (_, i) =>
        insertSessionEvent(db, {
          sessionId: testSessionId,
          type: 'test',
          message: `Concurrent event ${i + 1}`,
        })
      );

      const results = await Promise.all(promises);
      const seqs = results.map(r => r.seq).sort((a, b) => a - b);

      // すべて異なる seq が割り当てられていることを確認
      expect(seqs).toEqual([1, 2, 3, 4, 5]);
    });

    it('should populate all fields correctly', async () => {
      const event = await insertSessionEvent(db, {
        sessionId: testSessionId,
        type: 'user_action',
        subtype: 'click',
        message: 'User clicked button',
      });

      expect(event.uuid).toBeDefined();
      expect(event.sessionId).toBe(testSessionId);
      expect(event.seq).toBe(1);
      expect(event.type).toBe('user_action');
      expect(event.subtype).toBe('click');
      expect(event.message).toBe('User clicked button');
      expect(event.createdAt).toBeInstanceOf(Date);
      expect(event.updatedAt).toBeInstanceOf(Date);
    });
  });
});
