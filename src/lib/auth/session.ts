/**
 * Server-side session management with HMAC signature.
 * Ensures session integrity and prevents client-side tampering.
 */

import { createHmac } from 'crypto';
import type { DrupalUser } from '@/types/drupal';
import { validateEnvVars } from '@/lib/env';

// Validate environment at module load time
validateEnvVars();

const SESSION_SECRET = import.meta.env.SESSION_SECRET || '';

const ALGORITHM = 'sha256';
const SEPARATOR = '.';

/**
 * Sign a session object and return serialized, signed cookie value.
 * Format: base64(JSON) + . + base64(HMAC signature)
 */
export function createSessionCookie(user: DrupalUser, maxAgeSeconds: number): string {
  const now = Date.now();
  const exp = now + maxAgeSeconds * 1000;

  // Store minimal data: uid, name, exp. Roles are NOT stored in the client cookie.
  const payload = {
    uid: user.uid,
    name: user.name,
    exp,
  };

  const jsonString = JSON.stringify(payload);
  const encoded = Buffer.from(jsonString).toString('base64');

  const signature = createHmac(ALGORITHM, SESSION_SECRET)
    .update(encoded)
    .digest('base64');

  return `${encoded}${SEPARATOR}${signature}`;
}

/**
 * Verify and deserialize a session cookie. Returns null if invalid or expired.
 * Note: roles are NOT restored from the cookie for security. In the future,
 * if role-based access control is needed, fetch roles from Drupal on-demand.
 */
export function verifySessionCookie(cookie: string): DrupalUser | null {
  try {
    const parts = cookie.split(SEPARATOR);
    if (parts.length !== 2) return null;

    const [encoded, signature] = parts;

    // Verify signature
    const expectedSignature = createHmac(ALGORITHM, SESSION_SECRET)
      .update(encoded)
      .digest('base64');

    if (signature !== expectedSignature) {
      return null;
    }

    // Decode and parse
    const jsonString = Buffer.from(encoded, 'base64').toString('utf-8');
    const payload = JSON.parse(jsonString);

    // Check expiration
    if (payload.exp && payload.exp < Date.now()) {
      return null;
    }

    // Validate minimal required fields
    if (!payload.uid || !payload.name) {
      return null;
    }

    return {
      uid: payload.uid,
      name: payload.name,
      roles: [], // Empty by design; roles should be fetched server-side if needed
    };
  } catch {
    return null;
  }
}
