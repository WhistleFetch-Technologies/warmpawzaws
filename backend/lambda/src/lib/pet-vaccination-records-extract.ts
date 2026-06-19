/**
 * Extract vaccination schedule inputs from pets table rows.
 * Keep vaccination array shape aligned with EnhancedAddPetModal save payload.
 */

import type { ScheduleVaccinationRecord } from './pet-vaccination-schedule';

function isNonEmptyDate(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function dateFromEntry(rec: Record<string, unknown>): string {
  return String(rec.date ?? rec.lastDate ?? rec.administered_date ?? rec.administeredDate ?? '').trim();
}

function nextDueFromEntry(rec: Record<string, unknown>): string | undefined {
  const v = rec.nextDueDate ?? rec.nextDue ?? rec.next_due_date;
  return isNonEmptyDate(v) ? String(v).trim() : undefined;
}

function nameFromEntry(rec: Record<string, unknown>): string {
  return String(rec.name ?? rec.type ?? rec.vaccine ?? rec.payloadName ?? 'Vaccination').trim();
}

function keyFromEntry(rec: Record<string, unknown>): string | undefined {
  const k = rec.vaccineKey ?? rec.key;
  return typeof k === 'string' && k.trim() ? k.trim() : undefined;
}

function mapArrayToRecords(entries: unknown[]): ScheduleVaccinationRecord[] {
  const out: ScheduleVaccinationRecord[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const lastDate = dateFromEntry(rec);
    if (!lastDate) continue;
    out.push({
      id: typeof rec.id === 'string' ? rec.id : undefined,
      vaccineKey: keyFromEntry(rec),
      name: nameFromEntry(rec),
      lastDate,
      nextDueDate: nextDueFromEntry(rec),
    });
  }
  return out;
}

export function extractPetDob(pet: {
  medical_history?: Record<string, unknown> | null;
}): string {
  const mh = (pet.medical_history || {}) as Record<string, unknown>;
  const dob = mh.dob ?? mh.dateOfBirth ?? mh.date_of_birth;
  return isNonEmptyDate(dob) ? String(dob).trim() : '';
}

export function extractScheduleVaccinationRecords(pet: {
  medical_history?: Record<string, unknown> | null;
  vaccination_records?: unknown;
}): ScheduleVaccinationRecord[] {
  const mh = (pet.medical_history || {}) as Record<string, unknown>;
  const nested = mh.vaccinations;
  if (Array.isArray(nested) && nested.length > 0) {
    return mapArrayToRecords(nested);
  }

  const direct = pet.vaccination_records;
  if (Array.isArray(direct) && direct.length > 0) {
    return mapArrayToRecords(direct);
  }

  return [];
}

export function petHasVaccinationScheduleInputs(pet: {
  medical_history?: Record<string, unknown> | null;
  vaccination_records?: unknown;
}): boolean {
  const dob = extractPetDob(pet);
  const records = extractScheduleVaccinationRecords(pet);
  return Boolean(dob) || records.length > 0;
}
