const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAdminActorUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Returns a UUID suitable for UUID columns, or null for non-UUID actors (e.g. UAT). */
export function toOptionalAdminActorUuid(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return isAdminActorUuid(value) ? value : null;
}
