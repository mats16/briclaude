// apps/api/src/utils/encryption.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, DecryptionError } from './encryption.js';

describe('encryption', () => {
  const originalEnv = process.env.ENCRYPTION_KEY;
  const testKey = 'a'.repeat(64); // 64文字の16進数（32バイト）

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = testKey;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  describe('encrypt', () => {
    it('should encrypt plaintext and return base64 encoded string', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      // Base64形式であることを確認
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'Same text';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty string', () => {
      const encrypted = encrypt('');
      expect(encrypted).toBeDefined();
    });

    it('should handle unicode characters', () => {
      const plaintext = '日本語テスト 🎉';
      const encrypted = encrypt(plaintext);
      expect(encrypted).toBeDefined();
    });

    it('should handle long text', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encrypt(plaintext);
      expect(encrypted).toBeDefined();
    });
  });

  describe('decrypt', () => {
    it('should decrypt ciphertext back to original plaintext', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should correctly decrypt unicode characters', () => {
      const plaintext = '日本語テスト 🎉 emoji';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should correctly decrypt empty string', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should correctly decrypt long text', () => {
      const plaintext = 'test'.repeat(2500);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw DecryptionError for tampered ciphertext', () => {
      const plaintext = 'Secret data';
      const encrypted = encrypt(plaintext);

      // 暗号文を改ざん
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[20] = buffer[20] ^ 0xff; // 1バイトを反転
      const tampered = buffer.toString('base64');

      expect(() => decrypt(tampered)).toThrow(DecryptionError);
      expect(() => decrypt(tampered)).toThrow('Decryption failed');
    });

    it('should throw DecryptionError for too short ciphertext', () => {
      // 最小長 28バイト未満
      const tooShort = Buffer.alloc(20).toString('base64');

      expect(() => decrypt(tooShort)).toThrow(DecryptionError);
      expect(() => decrypt(tooShort)).toThrow('too short');
    });

    it('should throw DecryptionError with cause for crypto errors', () => {
      const plaintext = 'Secret data';
      const encrypted = encrypt(plaintext);

      // auth tag を改ざん（最後の16バイト）
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[buffer.length - 1] = buffer[buffer.length - 1] ^ 0xff;
      const tampered = buffer.toString('base64');

      try {
        decrypt(tampered);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DecryptionError);
        expect((error as DecryptionError).cause).toBeDefined();
      }
    });
  });

  describe('environment variable validation', () => {
    it('should throw error when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY;

      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY is not set');
    });

    it('should throw error when ENCRYPTION_KEY is wrong length', () => {
      process.env.ENCRYPTION_KEY = 'tooshort';

      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be 64 hex characters');
    });
  });
});
