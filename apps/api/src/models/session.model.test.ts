// apps/api/src/models/session.model.test.ts
import { describe, it, expect } from 'vitest';
import { TypeID } from 'typeid-js';
import { SessionId } from './session.model.js';

describe('SessionId', () => {
  describe('constructor', () => {
    it('should generate a new SessionId with UUIDv7', () => {
      const sessionId = new SessionId();

      expect(sessionId.toString()).toMatch(/^session_[a-z0-9]{26}$/);
      expect(sessionId.toUUID()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should generate unique IDs', () => {
      const id1 = new SessionId();
      const id2 = new SessionId();

      expect(id1.toString()).not.toBe(id2.toString());
      expect(id1.toUUID()).not.toBe(id2.toUUID());
    });

    it('should return "session" prefix', () => {
      const sessionId = new SessionId();

      expect(sessionId.getType()).toBe('session');
    });
  });

  describe('fromUUID', () => {
    it('should create SessionId from valid UUIDv7', () => {
      const original = new SessionId();
      const uuid = original.toUUID();
      const sessionId = SessionId.fromUUID(uuid);

      expect(sessionId.toUUID()).toBe(uuid);
      expect(sessionId.toString()).toMatch(/^session_/);
    });

    it('should roundtrip UUID correctly', () => {
      const original = new SessionId();
      const uuid = original.toUUID();
      const restored = SessionId.fromUUID(uuid);

      expect(restored.toUUID()).toBe(uuid);
      expect(restored.toString()).toBe(original.toString());
    });

    it('should return SessionId instance', () => {
      const uuid = new SessionId().toUUID();
      const sessionId = SessionId.fromUUID(uuid);

      expect(sessionId).toBeInstanceOf(SessionId);
      expect(sessionId).toBeInstanceOf(TypeID);
    });
  });

  describe('fromString', () => {
    it('should create SessionId from valid TypeID string', () => {
      const original = new SessionId();
      const typeIdStr = original.toString();
      const sessionId = SessionId.fromString(typeIdStr);

      expect(sessionId.toString()).toBe(typeIdStr);
    });

    it('should throw error for invalid TypeID prefix', () => {
      expect(() => SessionId.fromString('user_01h455vb4pex5vsknk084sn02q')).toThrow();
    });

    it('should throw error for invalid TypeID format', () => {
      expect(() => SessionId.fromString('invalid')).toThrow();
    });

    it('should roundtrip TypeID correctly', () => {
      const original = new SessionId();
      const typeIdStr = original.toString();
      const restored = SessionId.fromString(typeIdStr);

      expect(restored.toString()).toBe(typeIdStr);
      expect(restored.toUUID()).toBe(original.toUUID());
    });

    it('should return SessionId instance', () => {
      const typeIdStr = new SessionId().toString();
      const sessionId = SessionId.fromString(typeIdStr);

      expect(sessionId).toBeInstanceOf(SessionId);
      expect(sessionId).toBeInstanceOf(TypeID);
    });
  });

  describe('fromUUIDBytes', () => {
    it('should create SessionId from UUID bytes', () => {
      const original = new SessionId();
      const bytes = original.toUUIDBytes();
      const sessionId = SessionId.fromUUIDBytes(bytes);

      expect(sessionId.toUUID()).toBe(original.toUUID());
      expect(sessionId.toString()).toBe(original.toString());
    });

    it('should return SessionId instance', () => {
      const bytes = new SessionId().toUUIDBytes();
      const sessionId = SessionId.fromUUIDBytes(bytes);

      expect(sessionId).toBeInstanceOf(SessionId);
      expect(sessionId).toBeInstanceOf(TypeID);
    });
  });

  describe('inherited TypeID methods', () => {
    it('toUUID should return valid UUIDv7 format', () => {
      const sessionId = new SessionId();
      const uuid = sessionId.toUUID();

      // UUID v7 format validation (version 7 in the 13th character)
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('toString should return TypeID format with session prefix', () => {
      const sessionId = new SessionId();
      const str = sessionId.toString();

      expect(str).toMatch(/^session_[a-z0-9]{26}$/);
    });

    it('getType should return "session" prefix', () => {
      const sessionId = new SessionId();

      expect(sessionId.getType()).toBe('session');
    });

    it('getSuffix should return base32 encoded suffix', () => {
      const sessionId = new SessionId();
      const suffix = sessionId.getSuffix();

      expect(suffix).toMatch(/^[a-z0-9]{26}$/);
      expect(sessionId.toString()).toBe(`session_${suffix}`);
    });

    it('toUUIDBytes should return Uint8Array of 16 bytes', () => {
      const sessionId = new SessionId();
      const bytes = sessionId.toUUIDBytes();

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(16);
    });

    it('toUUIDBytes should be consistent with toUUID', () => {
      const sessionId = new SessionId();
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
      const original = new SessionId();
      const typeIdStr = original.toString();
      const uuid = original.toUUID();

      const fromTypeId = SessionId.fromString(typeIdStr);
      const fromUuid = SessionId.fromUUID(uuid);

      expect(fromTypeId.toUUID()).toBe(uuid);
      expect(fromTypeId.toString()).toBe(typeIdStr);
      expect(fromUuid.toString()).toBe(typeIdStr);
      expect(fromUuid.toUUID()).toBe(uuid);
    });
  });

  describe('Type compatibility', () => {
    it('SessionId should be assignable to TypeID<"session">', () => {
      const sessionId = new SessionId();
      const typeId: TypeID<'session'> = sessionId;

      expect(typeId.getType()).toBe('session');
    });

    it('SessionId extends TypeID', () => {
      const sessionId = new SessionId();

      expect(sessionId).toBeInstanceOf(TypeID);
    });
  });
});
