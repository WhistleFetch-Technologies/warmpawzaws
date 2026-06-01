/**
 * Normalize pet health / vaccination fields between DB storage and customer-app UI.
 */

export type PetVaccinationMap = {
  rabies?: string;
  distemper?: string;
  parvovirus?: string;
  other?: string;
};

function isNonEmptyDate(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function sanitizeVaccinationMap(v: PetVaccinationMap | Record<string, unknown>): PetVaccinationMap {
  return {
    rabies: isNonEmptyDate(v.rabies) ? String(v.rabies) : undefined,
    distemper: isNonEmptyDate(v.distemper) ? String(v.distemper) : undefined,
    parvovirus: isNonEmptyDate(v.parvovirus) ? String(v.parvovirus) : undefined,
    other: isNonEmptyDate(v.other) ? String(v.other) : undefined,
  };
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
      return {
        rabies: isNonEmptyDate(obj.rabies) ? obj.rabies : undefined,
        distemper: isNonEmptyDate(obj.distemper) ? obj.distemper : undefined,
        parvovirus: isNonEmptyDate(obj.parvovirus) ? obj.parvovirus : undefined,
        other: isNonEmptyDate(obj.other) ? String(obj.other) : undefined,
      };
    }
  }

  if (Array.isArray(vacRecords) && vacRecords.length > 0) {
    const flat: PetVaccinationMap = {};
    for (const entry of vacRecords) {
      if (!entry || typeof entry !== 'object') continue;
      const rec = entry as Record<string, unknown>;
      const label = String(rec.key ?? rec.name ?? rec.vaccine ?? rec.type ?? '').toLowerCase();
      const date = String(rec.date ?? rec.lastDate ?? rec.administered_date ?? rec.administeredDate ?? '').trim();
      if (!date) continue;
      if (label.includes('rabies')) flat.rabies = date;
      else if (label.includes('distemper')) flat.distemper = date;
      else if (label.includes('parvo')) flat.parvovirus = date;
      else if (!flat.other) flat.other = date;
    }
    if (Object.keys(flat).length > 0) return flat;
  }

  const vaccinationDates = mh.vaccinationDates as PetVaccinationMap | undefined;
  if (vaccinationDates && typeof vaccinationDates === 'object' && !Array.isArray(vaccinationDates)) {
    return sanitizeVaccinationMap(vaccinationDates);
  }

  const nested = mh.vaccinations;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const obj = nested as Record<string, unknown>;
    return {
      rabies: isNonEmptyDate(obj.rabies) ? obj.rabies : undefined,
      distemper: isNonEmptyDate(obj.distemper) ? obj.distemper : undefined,
      parvovirus: isNonEmptyDate(obj.parvovirus) ? obj.parvovirus : undefined,
      other: isNonEmptyDate(obj.other) ? String(obj.other) : undefined,
    };
  }

  return {};
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
    allergies: mh.allergies ?? '',
    medications: mh.medications ?? '',
    conditions: mh.conditions ?? '',
  };
}
