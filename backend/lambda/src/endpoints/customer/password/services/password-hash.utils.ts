/** True only for bcrypt or legacy PBKDF2 `salt:hex` — ignores stray non-null DB values so first-time setup can skip current password. */
export function hasMeaningfulStoredPassword(passwordHash: unknown): boolean {
  if (passwordHash == null || typeof passwordHash !== 'string') return false;
  const t = passwordHash.trim();
  if (!t) return false;
  if (t.startsWith('$2a$') || t.startsWith('$2b$') || t.startsWith('$2y$')) {
    return t.length >= 50;
  }
  const parts = t.split(':');
  if (parts.length >= 2 && parts[0].length > 0 && parts.slice(1).join(':').length > 8) {
    return true;
  }
  return false;
}
