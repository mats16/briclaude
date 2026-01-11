// apps/backend/src/models/session.model.test.ts
import { describe, it, expect } from 'vitest';
import { typeid, TypeID } from 'typeid-js';
import type { SessionId } from './session.model.js';

describe('SessionId (TypeID<"session">)', () => {
  describe('typeid("session")', () => {
    it('should generate a new SessionId with UUIDv7', () => {
      const sessionId: SessionId = typeid('session');

      expect(sessionId.toString()).toMatch(/^session_[a-z0-9]{26}$/);
      expect(sessionId.toUUID()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should generate unique IDs', () => {
      const id1: SessionId = typeid('session');
      const id2: SessionId = typeid('session');

      expect(id1.toString()).not.toBe(id2.toString());
      expect(id1.toUUID()).not.toBe(id2.toUUID());
    });

    it('should return TypeID<"session"> type', () => {
      const sessionId: SessionId = typeid('session');

      expect(sessionId.getType()).toBe('session');
    });
  });

  describe('TypeID.fromUUID("session", uuid)', () => {
    it('should create SessionId from valid UUIDv7', () => {
      const original: SessionId = typeid('session');
      const uuid = original.toUUID();
      const sessionId: SessionId = TypeID.fromUUID('session', uuid);

      expect(sessionId.toUUID()).toBe(uuid);
      expect(sessionId.toString()).toMatch(/^session_/);
    });

    it('should roundtrip UUID correctly', () => {
      const original: SessionId = typeid('session');
      const uuid = original.toUUID();
      const restored: SessionId = TypeID.fromUUID('session', uuid);

      expect(restored.toUUID()).toBe(uuid);
      expect(restored.toString()).toBe(original.toString());
    });
  });

  describe('TypeID.fromString(typeIdStr, "session")', () => {
    it('should create SessionId from valid TypeID string', () => {
      const original: SessionId = typeid('session');
      const typeIdStr = original.toString();
      const sessionId: SessionId = TypeID.fromString(typeIdStr, 'session');

      expect(sessionId.toString()).toBe(typeIdStr);
    });

    it('should throw error for invalid TypeID prefix', () => {
      expect(() => TypeID.fromString('user_01h455vb4pex5vsknk084sn02q', 'session')).toThrow();
    });

    it('should throw error for invalid TypeID format', () => {
      expect(() => TypeID.fromString('invalid', 'session')).toThrow();
    });

    it('should roundtrip TypeID correctly', () => {
      const original: SessionId = typeid('session');
      const typeIdStr = original.toString();
      const restored: SessionId = TypeID.fromString(typeIdStr, 'session');

      expect(restored.toString()).toBe(typeIdStr);
      expect(restored.toUUID()).toBe(original.toUUID());
    });
  });

  describe('SessionId methods (inherited from TypeID)', () => {
    it('toUUID should return valid UUIDv7 format', () => {
      const sessionId: SessionId = typeid('session');
      const uuid = sessionId.toUUID();

      // UUID v7 format validation (version 7 in the 13th character)
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('toString should return TypeID format with session prefix', () => {
      const sessionId: SessionId = typeid('session');
      const str = sessionId.toString();

      expect(str).toMatch(/^session_[a-z0-9]{26}$/);
    });

    it('getType should return "session" prefix', () => {
      const sessionId: SessionId = typeid('session');

      expect(sessionId.getType()).toBe('session');
    });

    it('getSuffix should return base32 encoded suffix', () => {
      const sessionId: SessionId = typeid('session');
      const suffix = sessionId.getSuffix();

      expect(suffix).toMatch(/^[a-z0-9]{26}$/);
      expect(sessionId.toString()).toBe(`session_${suffix}`);
    });

    it('toUUIDBytes should return Uint8Array of 16 bytes', () => {
      const sessionId: SessionId = typeid('session');
      const bytes = sessionId.toUUIDBytes();

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(16);
    });

    it('toUUIDBytes should be consistent with toUUID', () => {
      const sessionId: SessionId = typeid('session');
      const uuid = sessionId.toUUID();
      const bytes = sessionId.toUUIDBytes();

      // Convert bytes back to UUID string for comparison
      const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const reconstructedUuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

      expect(reconstructedUuid).toBe(uuid);
    });
  });

  describe('TypeID to UUID conversion consistency', () => {
    it('should maintain consistency between TypeID and UUID representations', () => {
      const original: SessionId = typeid('session');
      const typeIdStr = original.toString();
      const uuid = original.toUUID();

      const fromTypeId: SessionId = TypeID.fromString(typeIdStr, 'session');
      const fromUuid: SessionId = TypeID.fromUUID('session', uuid);

      expect(fromTypeId.toUUID()).toBe(uuid);
      expect(fromTypeId.toString()).toBe(typeIdStr);
      expect(fromUuid.toString()).toBe(typeIdStr);
      expect(fromUuid.toUUID()).toBe(uuid);
    });
  });

  describe('Type safety', () => {
    it('SessionId should be assignable to TypeID<"session">', () => {
      const sessionId: SessionId = typeid('session');

      // This should compile and work
      expect(sessionId.getType()).toBe('session');
    });
  });
});
