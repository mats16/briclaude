// apps/backend/src/utils/encryption.ts
import crypto from 'crypto';

/**
 * 暗号化キーを取得
 * 環境変数 ENCRYPTION_KEY から64文字の16進数文字列を読み込み、32バイトのBufferに変換
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY is not set in environment variables');
  }
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

/**
 * テキストを暗号化（AES-256-GCM）
 *
 * @param plaintext - 暗号化するテキスト
 * @returns Base64エンコードされた暗号文（IV + encrypted data + auth tag）
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();

  // IV (Initialization Vector) を生成（12バイト）
  const iv = crypto.randomBytes(12);

  // Cipher インスタンスを作成
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  // データを暗号化
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // 認証タグを取得（16バイト）
  const authTag = cipher.getAuthTag();

  // IV + encrypted data + auth tag を連結してBase64エンコード
  const combined = Buffer.concat([iv, Buffer.from(encrypted, 'hex'), authTag]);
  return combined.toString('base64');
}

/**
 * 暗号文を復号化（AES-256-GCM）
 *
 * @param ciphertext - Base64エンコードされた暗号文（IV + encrypted data + auth tag）
 * @returns 復号化されたテキスト
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();

  // Base64デコード
  const combined = Buffer.from(ciphertext, 'base64');

  // IV (12バイト)、encrypted data、auth tag (16バイト) を分離
  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(combined.length - 16);
  const encrypted = combined.subarray(12, combined.length - 16);

  // Decipher インスタンスを作成
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  // データを復号化
  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
