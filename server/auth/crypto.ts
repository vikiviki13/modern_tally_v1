import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;

/**
 * Derives a cryptographically secure hash of a password using scrypt.
 * Never stores plain text passwords.
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

/**
 * Verifies a password candidate against stored hash & salt using constant-time comparison.
 * Resilient against timing attacks.
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
    const hashBuffer = Buffer.from(hash, 'hex');
    if (derivedKey.length !== hashBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(derivedKey, hashBuffer);
  } catch {
    return false;
  }
}

/**
 * Generates an unguessable high-entropy random token.
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Cryptographic HMAC-SHA256 Token Signing & Verification
 */
export function signTokenPayload<T extends object>(payload: T, secret: string, expiresInMs: number = 86400000): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Date.now();
  const claims = {
    ...payload,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + expiresInMs) / 1000),
  };
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

export function verifyTokenPayload<T>(token: string, secret: string): { valid: boolean; payload?: T; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed token structure' };
    }
    const [header, body, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest('base64url');

    const expectedBuffer = Buffer.from(expectedSignature);
    const actualBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
      return { valid: false, error: 'Invalid token signature' };
    }

    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);

    if (claims.exp && claims.exp < now) {
      return { valid: false, error: 'Token has expired' };
    }

    return { valid: true, payload: claims as T };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Token verification failed';
    return { valid: false, error: message };
  }
}
