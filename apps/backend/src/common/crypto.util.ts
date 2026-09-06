import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// Ensure 32-byte key derived from JWT_SECRET or fallback
function getEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET || 'finpilot-broker-encryption-secret-key-32bytes!';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plain text string using AES-256-GCM
 * Returns string in format: "iv:authTag:encryptedData" (hex encoded)
 */
export function encryptText(text: string): string {
  if (!text) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for AES-GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string
 */
export function decryptText(encryptedString: string): string {
  if (!encryptedString) return '';
  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) return '';

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return '';
  }
}

/**
 * Generate 6-digit TOTP token using RFC 6238 HMAC-SHA1 algorithm (built-in crypto)
 */
export function generateTotpCode(secret: string): string {
  if (!secret) return '000000';
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const cleanSecret = secret.toUpperCase().replace(/=/g, '').replace(/\s+/g, '');
  for (let i = 0; i < cleanSecret.length; i++) {
    const val = base32chars.indexOf(cleanSecret.charAt(i));
    if (val !== -1) {
      bits += val.toString(2).padStart(5, '0');
    }
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  const key = Buffer.from(bytes);

  const epoch = Math.floor(Date.now() / 1000);
  const time = Math.floor(epoch / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(time), 0);

  const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, '0');
}

