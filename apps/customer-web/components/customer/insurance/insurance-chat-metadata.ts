/** Chat rows store insurance cards in jsonb. Drivers sometimes return that column as a string. */
export function parseInsuranceChatMetadata(value: unknown): Record<string, unknown> | null {
  let meta = value;
  if (typeof meta === 'string') {
    const trimmed = meta.trim();
    if (!trimmed.startsWith('{')) return null;
    try {
      meta = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const card = (meta as Record<string, unknown>).card;
  if (typeof card !== 'string' || !card.trim()) return null;
  return meta as Record<string, unknown>;
}
