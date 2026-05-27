/** Accent + tint for home service category cards (matches design mockup). */
export interface CategoryCardTheme {
  iconColor: string;
  tintColor: string;
}

const DEFAULT_THEME: CategoryCardTheme = {
  iconColor: '#6B7280',
  tintColor: 'rgba(107, 114, 128, 0.07)',
};

/** Per-category themes aligned with the home mockup. */
export const HOME_SERVICE_CARD_THEMES: Record<string, CategoryCardTheme> = {
  grooming: { iconColor: '#FF7843', tintColor: 'rgba(255, 120, 67, 0.08)' },
  vet: { iconColor: '#3B82F6', tintColor: 'rgba(59, 130, 246, 0.08)' },
  veterinary: { iconColor: '#3B82F6', tintColor: 'rgba(59, 130, 246, 0.08)' },
  boarding: { iconColor: '#8B5CF6', tintColor: 'rgba(139, 92, 246, 0.08)' },
  walker: { iconColor: '#22C55E', tintColor: 'rgba(34, 197, 94, 0.08)' },
  walking: { iconColor: '#22C55E', tintColor: 'rgba(34, 197, 94, 0.08)' },
  training: { iconColor: '#3B82F6', tintColor: 'rgba(59, 130, 246, 0.08)' },
  nutritionist: { iconColor: '#FF7843', tintColor: 'rgba(255, 120, 67, 0.08)' },
  nutrition: { iconColor: '#FF7843', tintColor: 'rgba(255, 120, 67, 0.08)' },
  wellness: { iconColor: '#FF7843', tintColor: 'rgba(255, 120, 67, 0.08)' },
  'pet-sitter': { iconColor: '#EC4899', tintColor: 'rgba(236, 72, 153, 0.08)' },
  pet_sitter: { iconColor: '#EC4899', tintColor: 'rgba(236, 72, 153, 0.08)' },
  sitting: { iconColor: '#EC4899', tintColor: 'rgba(236, 72, 153, 0.08)' },
  pharmacy: { iconColor: '#EF4444', tintColor: 'rgba(239, 68, 68, 0.08)' },
  shop: { iconColor: '#EC4899', tintColor: 'rgba(236, 72, 153, 0.08)' },
  'lab-diagnostics': { iconColor: '#14B8A6', tintColor: 'rgba(20, 184, 166, 0.08)' },
};

const TAILWIND_TEXT_HEX: Record<string, string> = {
  'blue-600': '#2563EB',
  'green-600': '#16A34A',
  'orange-600': '#EA580C',
  'red-600': '#DC2626',
  'purple-600': '#9333EA',
  'pink-600': '#DB2777',
  'amber-600': '#D97706',
  'teal-600': '#0D9488',
  'cyan-600': '#0891B2',
  'indigo-600': '#4F46E5',
  'slate-700': '#334155',
  'gray-600': '#4B5563',
};

function themeFromTailwindColor(colorClass: string): CategoryCardTheme | null {
  const textMatch = colorClass.match(/text-([\w]+-\d+)/);
  if (!textMatch) return null;
  const hex = TAILWIND_TEXT_HEX[textMatch[1]];
  if (!hex) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { iconColor: hex, tintColor: `rgba(${r}, ${g}, ${b}, 0.08)` };
}

export function getCategoryCardTheme(screenOrCategory: string | undefined, colorClass?: string): CategoryCardTheme {
  if (screenOrCategory) {
    const key = screenOrCategory.toLowerCase().trim();
    const preset = HOME_SERVICE_CARD_THEMES[key];
    if (preset) return preset;
  }
  if (colorClass) {
    const fromTw = themeFromTailwindColor(colorClass);
    if (fromTw) return fromTw;
  }
  return DEFAULT_THEME;
}

/** Short labels for the home category row (mockup copy). */
export const HOME_SERVICE_DISPLAY_LABELS: Record<string, string> = {
  nutritionist: 'Nutrition',
  nutrition: 'Nutrition',
  wellness: 'Nutrition',
  'pet-sitter': 'Sitting',
  pet_sitter: 'Sitting',
  sitting: 'Sitting',
  walker: 'Walking',
  walking: 'Walking',
  veterinary: 'Vet Care',
  vet: 'Vet Care',
};
