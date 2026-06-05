/**
 * Map wizard / API vaccine labels to the flat history slots (Rabies, Distemper, Parvovirus, other).
 * Keep in sync with backend/lambda/src/utils/pet-health-normalize.ts
 */

export type VaccinationSlot = 'rabies' | 'distemper' | 'parvovirus' | 'other';

export function mapVaccineLabelToSlot(label: string): VaccinationSlot {
  const l = String(label || '').toLowerCase();
  if (l.includes('rabies')) return 'rabies';
  if (l.includes('distemper') || l.includes('dhpp') || l.includes('dhp') || l.includes('hepatitis')) {
    return 'distemper';
  }
  if (l.includes('parvo')) return 'parvovirus';
  return 'other';
}

export type VaccinationFlatMap = {
  rabies?: string;
  distemper?: string;
  parvovirus?: string;
  other?: string;
};

function vaccineDateFromEntry(rec: Record<string, unknown>): string {
  return String(rec.date ?? rec.lastDate ?? rec.administered_date ?? rec.administeredDate ?? '').trim();
}

function vaccineLabelFromEntry(rec: Record<string, unknown>): string {
  return String(rec.key ?? rec.name ?? rec.vaccine ?? rec.type ?? rec.payloadName ?? '');
}

/** Flatten Add Pet wizard array or legacy API arrays into dashboard slots. */
export function flatMapFromVaccinationEntries(entries: unknown[]): VaccinationFlatMap {
  const flat: VaccinationFlatMap = {};
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const date = vaccineDateFromEntry(rec);
    if (!date) continue;
    const slot = mapVaccineLabelToSlot(vaccineLabelFromEntry(rec));
    flat[slot] = date;
  }
  return flat;
}
