/**
 * Pure vaccination reminder date logic (no DB / FCM imports — safe for unit tests).
 */

import {
  computeNextDueDate,
  findRecordForScheduleItem,
  getAdultSchedule,
  getJuvenileSchedule,
  normalizePetSpecies,
  type PetSpecies,
  type VaccinationScheduleItem,
} from './pet-vaccination-schedule';
import {
  extractPetDob,
  extractScheduleVaccinationRecords,
  petHasVaccinationScheduleInputs,
} from './pet-vaccination-records-extract';

export const VACCINATION_REMINDER_DEEP_LINK = '/vet';

const IST_TIMEZONE = 'Asia/Kolkata';

export type VaccinationReminderCandidate = {
  petId: string;
  petName: string;
  customerId: string;
  vaccineKey: string;
  vaccineName: string;
  dueDate: string;
};

/** Calendar date YYYY-MM-DD in Asia/Kolkata for ref instant. */
export function getIstCalendarDateIso(ref: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIMEZONE }).format(ref);
}

/** Tomorrow's calendar date YYYY-MM-DD in Asia/Kolkata. */
export function getIstTomorrowDateIso(ref: Date = new Date()): string {
  const today = getIstCalendarDateIso(ref);
  const [y, m, d] = today.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

function resolveNextDueDate(
  item: VaccinationScheduleItem,
  dob: string,
  record: ReturnType<typeof findRecordForScheduleItem>,
  refDate: Date
): string {
  const stored = record?.nextDueDate?.trim();
  const computed = computeNextDueDate(item, dob, record?.lastDate, refDate);
  if (stored && computed && stored !== computed) {
    return computed;
  }
  return computed || stored || '';
}

export function collectVaccinationRemindersDueTomorrow(
  pet: {
    id: string;
    name: string;
    species: unknown;
    medical_history?: Record<string, unknown> | null;
    vaccination_records?: unknown;
  },
  refDate: Date = new Date()
): VaccinationReminderCandidate[] {
  if (!petHasVaccinationScheduleInputs(pet)) return [];

  const dob = extractPetDob(pet);
  const records = extractScheduleVaccinationRecords(pet);
  const species: PetSpecies = normalizePetSpecies(pet.species);
  const tomorrowIso = getIstTomorrowDateIso(refDate);
  const items = [...getJuvenileSchedule(species), ...getAdultSchedule(species)];
  const candidates: VaccinationReminderCandidate[] = [];

  for (const item of items) {
    const record = findRecordForScheduleItem(item, records);
    const nextDue = resolveNextDueDate(item, dob, record, refDate);
    if (!nextDue || nextDue !== tomorrowIso) continue;

    candidates.push({
      petId: String(pet.id),
      petName: String(pet.name || 'Your pet'),
      customerId: '',
      vaccineKey: item.key,
      vaccineName: item.displayName,
      dueDate: nextDue,
    });
  }

  return candidates;
}
