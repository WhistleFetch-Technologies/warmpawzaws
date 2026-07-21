/** Static category → service styles for category landing (no vendor SQL). */

export type CategoryStyleOption = {
  id: string;
  label: string;
  description: string;
};

const STYLE_LABELS: Record<string, { label: string; description: string }> = {
  tele: { label: 'Tele Consultation', description: 'Video call from anywhere' },
  at_home: { label: 'Home Visit', description: 'Provider comes to you' },
  at_center: { label: 'Clinic Visit', description: 'Visit a centre near you' },
};

const CATEGORY_STYLES: Record<string, string[]> = {
  vet: ['tele', 'at_home', 'at_center'],
  grooming: ['at_home', 'at_center'],
  training: ['at_center'],
  walker: ['at_home'],
  walking: ['at_home'],
  nutritionist: ['tele', 'at_home'],
  nutrition: ['tele', 'at_home'],
  boarding: ['at_center'],
  sitting: ['at_home'],
  behaviourist: ['at_center', 'at_home'],
  behavior: ['at_center', 'at_home'],
};

export function categoryBootstrapStyles(category?: string | null): CategoryStyleOption[] {
  const key = String(category || '')
    .toLowerCase()
    .trim();
  const ids = CATEGORY_STYLES[key] || ['at_center', 'at_home', 'tele'];
  return ids.map((id) => ({
    id,
    label: STYLE_LABELS[id]?.label || id,
    description: STYLE_LABELS[id]?.description || '',
  }));
}
