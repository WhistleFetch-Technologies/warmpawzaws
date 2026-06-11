/** Accent + tint for home service category cards (matches design mockup). */
export interface CategoryCardTheme {
  iconColor: string;
  tintColor: string;
  /** Slightly richer tint on hover — optional, derived when omitted. */
  tintColorHover?: string;
}

const DEFAULT_THEME: CategoryCardTheme = {
  iconColor: '#6B7280',
  tintColor: '#F3F4F6',
  tintColorHover: '#E5E7EB',
};

/** Per-category themes aligned with the home mockup. */
export const HOME_SERVICE_CARD_THEMES: Record<string, CategoryCardTheme> = {
  grooming: { iconColor: '#FF7843', tintColor: '#FFF4ED', tintColorHover: '#FFE8D9' },
  vet: { iconColor: '#3B82F6', tintColor: '#EFF6FF', tintColorHover: '#DBEAFE' },
  veterinary: { iconColor: '#3B82F6', tintColor: '#EFF6FF', tintColorHover: '#DBEAFE' },
  boarding: { iconColor: '#8B5CF6', tintColor: '#F5F3FF', tintColorHover: '#EDE9FE' },
  walker: { iconColor: '#22C55E', tintColor: '#ECFDF5', tintColorHover: '#D1FAE5' },
  walking: { iconColor: '#22C55E', tintColor: '#ECFDF5', tintColorHover: '#D1FAE5' },
  training: { iconColor: '#3B82F6', tintColor: '#EFF6FF', tintColorHover: '#DBEAFE' },
  behavioral: { iconColor: '#3B82F6', tintColor: '#EFF6FF', tintColorHover: '#DBEAFE' },
  nutritionist: { iconColor: '#FF7843', tintColor: '#FFF7ED', tintColorHover: '#FFEDD5' },
  nutrition: { iconColor: '#FF7843', tintColor: '#FFF7ED', tintColorHover: '#FFEDD5' },
  wellness: { iconColor: '#FF7843', tintColor: '#FFF7ED', tintColorHover: '#FFEDD5' },
  'pet-sitter': { iconColor: '#EC4899', tintColor: '#FDF2F8', tintColorHover: '#FCE7F3' },
  pet_sitter: { iconColor: '#EC4899', tintColor: '#FDF2F8', tintColorHover: '#FCE7F3' },
  sitting: { iconColor: '#EC4899', tintColor: '#FDF2F8', tintColorHover: '#FCE7F3' },
  pharmacy: { iconColor: '#EF4444', tintColor: '#FEF2F2', tintColorHover: '#FEE2E2' },
  shop: { iconColor: '#EC4899', tintColor: '#FDF2F8', tintColorHover: '#FCE7F3' },
  'lab-diagnostics': { iconColor: '#14B8A6', tintColor: '#F0FDFA', tintColorHover: '#CCFBF1' },
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
  return {
    iconColor: hex,
    tintColor: `rgba(${r}, ${g}, ${b}, 0.1)`,
    tintColorHover: `rgba(${r}, ${g}, ${b}, 0.16)`,
  };
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
  training: 'Training & Behaviorist',
  behavioral: 'Training & Behaviorist',
};
