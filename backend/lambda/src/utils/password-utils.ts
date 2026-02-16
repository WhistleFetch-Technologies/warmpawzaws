/**
 * Password hashing and verification utilities
 * Uses PBKDF2 for secure password hashing
 */

import * as crypto from 'crypto';

/**
 * Hash a password using PBKDF2
 * Returns format: salt:hash
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Compare a password with a stored hash
 * Returns true if password matches
 */
export async function comparePassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const derivedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === derivedHash;
}
