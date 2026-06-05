/** Include pending text input in list when user saves without tapping Plus. */
export function flushPendingListItem(items: string[], pending: string): string[] {
  const trimmed = pending.trim();
  if (!trimmed) return items;
  if (items.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return items;
  return [...items, trimmed];
}
