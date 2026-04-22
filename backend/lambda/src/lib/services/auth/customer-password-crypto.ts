/**
 * Customer password hashing (bcrypt) + verify legacy PBKDF2 "salt:hash" from older change-password flow.
 */
import * as crypto from 'crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

export async function hashCustomerPasswordBcrypt(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function verifyLegacyPbkdf2(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash || stored.startsWith('$2')) return false;
  const derived = crypto.pbkdf2Sync(plain, salt, 10000, 64, 'sha512').toString('hex');
  return hash === derived;
}

export async function verifyCustomerPassword(plain: string, storedHash: string | null | undefined): Promise<boolean> {
  if (!storedHash || !plain) return false;
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    return bcrypt.compare(plain, storedHash);
  }
  return verifyLegacyPbkdf2(plain, storedHash);
}
