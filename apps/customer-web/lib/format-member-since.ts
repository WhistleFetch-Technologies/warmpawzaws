/** Format profile `created_at` for "Member since May 2024" chips. */
export function formatMemberSinceLabel(createdAt?: string): string | undefined {
  if (!createdAt) return undefined;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}
