/** Move one item in a list. Returns the same array if `from`/`to` are out of range or equal. */
export function moveArrayItem<T>(list: T[], from: number, to: number): T[] {
  if (
    !Array.isArray(list) ||
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
