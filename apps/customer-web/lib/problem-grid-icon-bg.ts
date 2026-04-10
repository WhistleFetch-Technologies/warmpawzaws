/**
 * Maps admin specialization_master icon text classes (e.g. text-red-500) to soft tile backgrounds.
 * Mirrors admin catalog CategoriesTab getIconBg for visual parity.
 */
export function problemIconTextColorToBgClass(color: string | null | undefined): string | undefined {
  if (!color || typeof color !== 'string') return undefined;
  const c = color.trim();
  if (!c) return undefined;
  const mapping: Record<string, string> = {
    'text-blue-500': 'bg-blue-100',
    'text-blue-600': 'bg-blue-100',
    'text-green-500': 'bg-green-100',
    'text-green-600': 'bg-green-100',
    'text-orange-500': 'bg-orange-100',
    'text-red-500': 'bg-red-100',
    'text-red-600': 'bg-red-100',
    'text-purple-500': 'bg-purple-100',
    'text-purple-600': 'bg-purple-100',
    'text-pink-500': 'bg-pink-100',
    'text-amber-500': 'bg-amber-100',
    'text-amber-600': 'bg-amber-100',
    'text-teal-500': 'bg-teal-100',
    'text-teal-600': 'bg-teal-100',
    'text-cyan-500': 'bg-cyan-100',
    'text-indigo-500': 'bg-indigo-100',
    'text-indigo-600': 'bg-indigo-100',
    'text-gray-500': 'bg-gray-100',
    'text-gray-600': 'bg-gray-100',
  };
  return mapping[c] ?? 'bg-gray-100';
}
