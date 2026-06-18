/**
 * Normalize pet health / vaccination fields between DB storage and customer-app UI.
 */

export type PetVaccinationMap = {
  rabies?: string;
  distemper?: string;
  parvovirus?: string;
  other?: string;
};

export type VaccinationSlot = keyof PetVaccinationMap;

function isNonEmptyDate(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Map wizard / stored vaccine names to flat history slots (incl. DHPP → distemper). */
export function mapVaccineLabelToSlot(label: string): VaccinationSlot {
  const l = String(label || '').toLowerCase();
  if (l.includes('rabies')) return 'rabies';
  if (l.includes('distemper') || l.includes('dhpp') || l.includes('dhp') || l.includes('hepatitis')) {
    return 'distemper';
  }
  if (l.includes('parvo')) return 'parvovirus';
  return 'other';
}

function vaccineDateFromEntry(rec: Record<string, unknown>): string {
  return String(rec.date ?? rec.lastDate ?? rec.administered_date ?? rec.administeredDate ?? '').trim();
}

function vaccineLabelFromEntry(rec: Record<string, unknown>): string {
  return String(rec.key ?? rec.vaccineKey ?? rec.name ?? rec.vaccine ?? rec.type ?? rec.payloadName ?? '');
}

/** Flatten wizard / legacy vaccination arrays into { rabies, distemper, parvovirus, other }. */
export function flatMapFromVaccinationEntries(entries: unknown[]): PetVaccinationMap {
  const flat: PetVaccinationMap = {};
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

function applyFlatMapFromArray(entries: unknown[], into: PetVaccinationMap): void {
  const mapped = flatMapFromVaccinationEntries(entries);
  for (const key of Object.keys(mapped) as VaccinationSlot[]) {
    if (mapped[key]) into[key] = mapped[key];
  }
}

export function sanitizeVaccinationMap(v: PetVaccinationMap | Record<string, unknown>): PetVaccinationMap {
  return {
    rabies: isNonEmptyDate(v.rabies) ? String(v.rabies) : undefined,
    distemper: isNonEmptyDate(v.distemper) ? String(v.distemper) : undefined,
    parvovirus: isNonEmptyDate(v.parvovirus) ? String(v.parvovirus) : undefined,
    other: isNonEmptyDate(v.other) ? String(v.other) : undefined,
  };
}

function formatHealthListField(value: unknown): string {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0 && item.toLowerCase() !== 'none')
      .join(', ');
  }
  const text = String(value).trim();
  return text.toLowerCase() === 'none' ? '' : text;
}

/** Flat UI map { rabies, distemper, parvovirus } from DB row fields. */
export function extractVaccinationsForClient(pet: {
  vaccination_records?: unknown;
  medical_history?: Record<string, unknown> | null;
  healthRecords?: Record<string, unknown> | null;
}): PetVaccinationMap {
  const mh = (pet.medical_history || pet.healthRecords || {}) as Record<string, unknown>;
  const vacRecords = pet.vaccination_records;

  if (vacRecords && typeof vacRecords === 'object' && !Array.isArray(vacRecords)) {
    const obj = vacRecords as Record<string, unknown>;
    if (isNonEmptyDate(obj.rabies) || isNonEmptyDate(obj.distemper) || isNonEmptyDate(obj.parvovirus)) {
      return sanitizeVaccinationMap({
        rabies: isNonEmptyDate(obj.rabies) ? obj.rabies : undefined,
        distemper: isNonEmptyDate(obj.distemper) ? obj.distemper : undefined,
        parvovirus: isNonEmptyDate(obj.parvovirus) ? obj.parvovirus : undefined,
        other: isNonEmptyDate(obj.other) ? String(obj.other) : undefined,
      });
    }
  }

  const flat: PetVaccinationMap = {};

  if (Array.isArray(vacRecords) && vacRecords.length > 0) {
    applyFlatMapFromArray(vacRecords, flat);
  }

  const vaccinationDates = mh.vaccinationDates;
  if (vaccinationDates && typeof vaccinationDates === 'object' && !Array.isArray(vaccinationDates)) {
    Object.assign(flat, sanitizeVaccinationMap(vaccinationDates as PetVaccinationMap));
  }

  const nested = mh.vaccinations;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const obj = nested as Record<string, unknown>;
    Object.assign(
      flat,
      sanitizeVaccinationMap({
        rabies: isNonEmptyDate(obj.rabies) ? obj.rabies : undefined,
        distemper: isNonEmptyDate(obj.distemper) ? obj.distemper : undefined,
        parvovirus: isNonEmptyDate(obj.parvovirus) ? obj.parvovirus : undefined,
        other: isNonEmptyDate(obj.other) ? String(obj.other) : undefined,
      })
    );
  } else if (Array.isArray(nested) && nested.length > 0) {
    applyFlatMapFromArray(nested, flat);
  }

  return sanitizeVaccinationMap(flat);
}

/** Merge health record fields for medical_history JSONB. */
export function mergeHealthRecordsForStorage(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const base = { ...(existing || {}) };
  const hr = incoming || {};
  const merged: Record<string, unknown> = {
    ...base,
    ...hr,
    lastCheckup: hr.lastCheckup ?? hr.last_checkup ?? base.lastCheckup ?? base.last_checkup,
    allergies: hr.allergies ?? base.allergies,
    medications: hr.medications ?? base.medications,
    conditions: hr.conditions ?? base.conditions,
  };

  if (hr.vaccinationDates && typeof hr.vaccinationDates === 'object' && !Array.isArray(hr.vaccinationDates)) {
    const prev =
      base.vaccinationDates && typeof base.vaccinationDates === 'object' && !Array.isArray(base.vaccinationDates)
        ? (base.vaccinationDates as Record<string, unknown>)
        : {};
    merged.vaccinationDates = { ...prev, ...(hr.vaccinationDates as Record<string, unknown>) };
  }

  return merged;
}

/** Persist vaccinations in both flat map (vaccination_records) and medical_history.vaccinationDates. */
export function buildVaccinationStorage(
  existingMedicalHistory: Record<string, unknown> | null | undefined,
  vaccinations: PetVaccinationMap | null | undefined
): {
  vaccination_records: PetVaccinationMap;
  medical_history: Record<string, unknown>;
} {
  const mh = { ...(existingMedicalHistory || {}) };
  const vac = vaccinations || {};
  const flat = sanitizeVaccinationMap(vac);

  mh.vaccinationDates = flat;

  return {
    vaccination_records: flat,
    medical_history: mh,
  };
}

export function extractHealthRecordsForClient(
  medicalHistory: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const mh = medicalHistory || {};
  return {
    lastCheckup: mh.lastCheckup ?? mh.last_checkup ?? '',
    allergies: formatHealthListField(mh.allergies),
    medications: formatHealthListField(mh.medications ?? mh.currentMedications ?? mh.current_medications),
    conditions: formatHealthListField(mh.conditions ?? mh.chronicConditions ?? mh.chronic_conditions),
  };
}
