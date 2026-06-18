/**
 * Hardcoded puppy/kitten + adult vaccination schedules for add-pet and profile views.
 */

export type PetSpecies = 'Dog' | 'Cat';

export type VaccinationScheduleKind = 'juvenile' | 'adult';

export type VaccinationRowStatus =
  | 'upcoming'
  | 'due'
  | 'overdue'
  | 'completed'
  | 'not_applicable';

export type VaccinationScheduleItem = {
  key: string;
  displayName: string;
  payloadName: string;
  description: string;
  ageLabel: string;
  minWeeks: number;
  maxWeeks?: number;
  scheduleKind: VaccinationScheduleKind;
  intervalDays?: number;
  recurringUntilMonths?: number;
};

export type ScheduleVaccinationRecord = {
  id?: string;
  vaccineKey?: string;
  name: string;
  lastDate?: string;
  nextDueDate?: string;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDate(dateStr: string): Date | null {
  const d = startOfDay(new Date(dateStr));
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

const JUVENILE_DOG: VaccinationScheduleItem[] = [
  {
    key: 'dog:juvenile:deworm-1',
    displayName: 'Deworming (Round 1)',
    payloadName: 'Deworming (Round 1)',
    description: 'Eliminates worms passed from mother.',
    ageLabel: '2 – 3 Weeks',
    minWeeks: 2,
    maxWeeks: 3,
    scheduleKind: 'juvenile',
  },
  {
    key: 'dog:juvenile:deworm-2',
    displayName: 'Deworming (Round 2)',
    payloadName: 'Deworming (Round 2)',
    description: 'Prevents intestinal damage from growing parasites.',
    ageLabel: '4 – 5 Weeks',
    minWeeks: 4,
    maxWeeks: 5,
    scheduleKind: 'juvenile',
  },
  {
    key: 'dog:juvenile:puppy-dp-deworm',
    displayName: 'Puppy DP Vaccine + Deworming',
    payloadName: 'Puppy DP Vaccine + Deworming',
    description: 'Protects against fatal Parvovirus and Distemper.',
    ageLabel: '6 – 8 Weeks',
    minWeeks: 6,
    maxWeeks: 8,
    scheduleKind: 'juvenile',
  },
  {
    key: 'dog:juvenile:combo-deworm-1',
    displayName: '7-in-1 / 9-in-1 Vaccine + Deworming',
    payloadName: '7-in-1 / 9-in-1 Vaccine + Deworming',
    description: 'Shields against Hepatitis, Influenza, and Leptospirosis.',
    ageLabel: '10 – 12 Weeks',
    minWeeks: 10,
    maxWeeks: 12,
    scheduleKind: 'juvenile',
  },
  {
    key: 'dog:juvenile:combo-booster-deworm',
    displayName: '7-in-1 / 9-in-1 Booster + Deworming',
    payloadName: '7-in-1 / 9-in-1 Booster + Deworming',
    description: 'Finalizes base immunity against core canine diseases.',
    ageLabel: '14 – 16 Weeks',
    minWeeks: 14,
    maxWeeks: 16,
    scheduleKind: 'juvenile',
  },
  {
    key: 'dog:juvenile:arv',
    displayName: 'Anti-Rabies Vaccine (ARV)',
    payloadName: 'Anti-Rabies Vaccine (ARV)',
    description: 'Mandatory protection against fatal Rabies virus.',
    ageLabel: '16 Weeks',
    minWeeks: 16,
    maxWeeks: 16,
    scheduleKind: 'juvenile',
    intervalDays: 365,
  },
  {
    key: 'dog:juvenile:deworm-monthly',
    displayName: 'Deworming Maintenance',
    payloadName: 'Deworming Maintenance',
    description: 'Controls ongoing parasite risk from soil/shoes.',
    ageLabel: 'Monthly (Up to 6 mos)',
    minWeeks: 17,
    maxWeeks: 26,
    scheduleKind: 'juvenile',
    intervalDays: 30,
    recurringUntilMonths: 6,
  },
];

const JUVENILE_CAT: VaccinationScheduleItem[] = [
  {
    key: 'cat:juvenile:deworm-1',
    displayName: 'Deworming (Round 1)',
    payloadName: 'Deworming (Round 1)',
    description: 'Eliminates roundworms and hookworms passed from the mother.',
    ageLabel: '2 – 3 Weeks',
    minWeeks: 2,
    maxWeeks: 3,
    scheduleKind: 'juvenile',
  },
  {
    key: 'cat:juvenile:deworm-2',
    displayName: 'Deworming (Round 2)',
    payloadName: 'Deworming (Round 2)',
    description:
      'Prevents intestinal damage from growing parasites as they transition to wet food.',
    ageLabel: '4 – 5 Weeks',
    minWeeks: 4,
    maxWeeks: 5,
    scheduleKind: 'juvenile',
  },
  {
    key: 'cat:juvenile:fvrcp-1-deworm',
    displayName: 'Feline 3-in-1 Vaccine (Round 1) + Deworming',
    payloadName: 'Feline 3-in-1 Vaccine (Round 1) + Deworming',
    description:
      'Protects against Feline Panleukopenia, Calicivirus, and Rhinotracheitis (FVRCP).',
    ageLabel: '6 – 8 Weeks',
    minWeeks: 6,
    maxWeeks: 8,
    scheduleKind: 'juvenile',
  },
  {
    key: 'cat:juvenile:fvrcp-2-deworm',
    displayName: 'Feline 3-in-1 Vaccine (Round 2) + Deworming',
    payloadName: 'Feline 3-in-1 Vaccine (Round 2) + Deworming',
    description: 'Booster shot to build strong, long-lasting immunity against the three core viruses.',
    ageLabel: '10 – 12 Weeks',
    minWeeks: 10,
    maxWeeks: 12,
    scheduleKind: 'juvenile',
  },
  {
    key: 'cat:juvenile:fvrcp-3-deworm',
    displayName: 'Feline 3-in-1 Vaccine (Round 3) + Deworming',
    payloadName: 'Feline 3-in-1 Vaccine (Round 3) + Deworming',
    description: 'Final core booster to ensure maximum protection against respiratory and gastric viruses.',
    ageLabel: '14 – 16 Weeks',
    minWeeks: 14,
    maxWeeks: 16,
    scheduleKind: 'juvenile',
  },
  {
    key: 'cat:juvenile:arv',
    displayName: 'Anti-Rabies Vaccine (ARV)',
    payloadName: 'Anti-Rabies Vaccine (ARV)',
    description: 'Mandatory legal protection against the fatal Rabies virus.',
    ageLabel: '16 Weeks',
    minWeeks: 16,
    maxWeeks: 16,
    scheduleKind: 'juvenile',
    intervalDays: 365,
  },
  {
    key: 'cat:juvenile:deworm-monthly',
    displayName: 'Deworming Maintenance',
    payloadName: 'Deworming Maintenance',
    description: 'Controls ongoing parasite risks from indoor shoes, dust, or soil.',
    ageLabel: 'Monthly (Up to 6 mos)',
    minWeeks: 17,
    maxWeeks: 26,
    scheduleKind: 'juvenile',
    intervalDays: 30,
    recurringUntilMonths: 6,
  },
];

const ADULT_DOG: VaccinationScheduleItem[] = [
  {
    key: 'dog:rabies',
    displayName: 'Rabies Vaccine',
    payloadName: 'Rabies Vaccine',
    description:
      'Protects dogs from the deadly rabies virus, prevents transmission to humans, and is usually given once yearly or as advised by the vet.',
    ageLabel: 'Annual',
    minWeeks: 0,
    scheduleKind: 'adult',
    intervalDays: 365,
  },
  {
    key: 'dog:dhpp',
    displayName: 'DHPP Vaccine',
    payloadName: 'DHPP Vaccine',
    description:
      'Protects against Distemper, Hepatitis, Parvovirus, and Parainfluenza, helping prevent severe contagious diseases, with booster doses generally recommended yearly or every 3 years.',
    ageLabel: 'Annual',
    minWeeks: 0,
    scheduleKind: 'adult',
    intervalDays: 365,
  },
  {
    key: 'dog:bordetella',
    displayName: 'Bordetella (Kennel Cough) Vaccine',
    payloadName: 'Bordetella (Kennel Cough) Vaccine',
    description:
      'Helps protect dogs from highly contagious kennel cough infections common in boarding, grooming, and daycare environments, usually taken annually or every 6–12 months for high-risk dogs.',
    ageLabel: 'Every 6–12 months',
    minWeeks: 0,
    scheduleKind: 'adult',
    intervalDays: 180,
  },
  {
    key: 'dog:leptospirosis',
    displayName: 'Leptospirosis Vaccine',
    payloadName: 'Leptospirosis Vaccine',
    description:
      'Protects against bacterial infections spread through contaminated water or urine that can affect both pets and humans, commonly administered once yearly.',
    ageLabel: 'Annual',
    minWeeks: 0,
    scheduleKind: 'adult',
    intervalDays: 365,
  },
  {
    key: 'dog:canine-influenza',
    displayName: 'Canine Influenza Vaccine',
    payloadName: 'Canine Influenza Vaccine',
    description:
      'Helps prevent dog flu infections that spread easily in social environments, reducing severity of respiratory illness, with annual booster recommendations.',
    ageLabel: 'Annual',
    minWeeks: 0,
    scheduleKind: 'adult',
    intervalDays: 365,
  },
  {
    key: 'dog:lyme',
    displayName: 'Lyme Disease Vaccine',
    payloadName: 'Lyme Disease Vaccine',
    description:
      'Protects dogs from Lyme disease caused by tick bites, helping reduce joint, kidney, and fever-related complications, typically recommended yearly in tick-prone areas.',
    ageLabel: 'Annual',
    minWeeks: 0,
    scheduleKind: 'adult',
    intervalDays: 365,
  },
];

const ADULT_CAT: VaccinationScheduleItem[] = [
  {
    key: 'cat:rabies',
    displayName: 'Rabies Vaccine',
    payloadName: 'Rabies Vaccine',
    description:
      'Protects cats from the deadly rabies virus, prevents transmission to humans, and is usually given once yearly or as advised by the vet.',
    ageLabel: 'Annual',
    minWeeks: 0,
    scheduleKind: 'adult',
    intervalDays: 365,
  },
  {
    key: 'cat:fvrcp',
    displayName: 'FVRCP Vaccine',
    payloadName: 'FVRCP Vaccine',
    description:
      'Protects against common feline respiratory and viral diseases like rhinotracheitis, calicivirus, and panleukopenia, typically taken annually or every 3 years after boosters.',
    ageLabel: 'Annual',
    minWeeks: 0,
    scheduleKind: 'adult',
    intervalDays: 365,
  },
  {
    key: 'cat:felv',
    displayName: 'FeLV Vaccine',
    payloadName: 'FeLV Vaccine',
    description:
      'Helps protect cats from feline leukemia virus that weakens the immune system, especially important for outdoor or multi-cat households, with yearly booster doses recommended.',
    ageLabel: 'Annual',
    minWeeks: 0,
    scheduleKind: 'adult',
    intervalDays: 365,
  },
  {
    key: 'cat:fiv',
    displayName: 'FIV Vaccine',
    payloadName: 'FIV Vaccine',
    description:
      'Helps reduce the risk of feline immunodeficiency virus infection that affects immunity, mainly recommended for high-risk outdoor cats, with boosters as advised by veterinarians.',
    ageLabel: 'Annual',
    minWeeks: 0,
    scheduleKind: 'adult',
    intervalDays: 365,
  },
  {
    key: 'cat:bordetella',
    displayName: 'Bordetella Vaccine',
    payloadName: 'Bordetella Vaccine',
    description:
      'Protects cats from Bordetella respiratory infections commonly spread in boarding or grooming environments, generally recommended annually for social or frequently traveling cats.',
    ageLabel: 'Annual',
    minWeeks: 0,
    scheduleKind: 'adult',
    intervalDays: 365,
  },
];

export const JUVENILE_VACCINATION_SCHEDULE: Record<PetSpecies, VaccinationScheduleItem[]> = {
  Dog: JUVENILE_DOG,
  Cat: JUVENILE_CAT,
};

export const ADULT_VACCINATION_SCHEDULE: Record<PetSpecies, VaccinationScheduleItem[]> = {
  Dog: ADULT_DOG,
  Cat: ADULT_CAT,
};

export function normalizePetSpecies(value: unknown): PetSpecies {
  const s = String(value || '').toLowerCase();
  return s.includes('cat') ? 'Cat' : 'Dog';
}

export function getAgeInWeeks(dob: string, refDate?: Date): number {
  const birth = parseIsoDate(dob);
  if (!birth) return 0;
  const ref = startOfDay(refDate ?? new Date());
  const diffMs = ref.getTime() - birth.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

export function getAgeInMonths(dob: string, refDate?: Date): number {
  const birth = new Date(dob);
  const ref = refDate ?? new Date();
  if (Number.isNaN(birth.getTime())) return 0;
  let months = (ref.getFullYear() - birth.getFullYear()) * 12 + (ref.getMonth() - birth.getMonth());
  if (ref.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

export function formatAgeWithWeeks(dob: string, refDate?: Date): string {
  const weeks = getAgeInWeeks(dob, refDate);
  const months = getAgeInMonths(dob, refDate);
  if (weeks < 52) {
    const monthPart = months > 0 ? ` (${months} month${months !== 1 ? 's' : ''})` : '';
    return `${weeks} week${weeks !== 1 ? 's' : ''}${monthPart}`;
  }
  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? 's' : ''}`;
}

export function getScheduledDueDate(dob: string, minWeeks: number): string {
  const birth = parseIsoDate(dob);
  if (!birth) return '';
  return addDays(birth, minWeeks * 7);
}

export function getJuvenileSchedule(species: PetSpecies): VaccinationScheduleItem[] {
  return JUVENILE_VACCINATION_SCHEDULE[species];
}

export function getAdultSchedule(species: PetSpecies): VaccinationScheduleItem[] {
  return ADULT_VACCINATION_SCHEDULE[species];
}

export function findRecordForScheduleItem(
  item: VaccinationScheduleItem,
  records: ScheduleVaccinationRecord[]
): ScheduleVaccinationRecord | undefined {
  return records.find(
    (r) =>
      r.vaccineKey === item.key ||
      (r.vaccineKey && r.vaccineKey === item.key) ||
      (r.name && r.name === item.payloadName)
  );
}

function isRecurringMaintenance(item: VaccinationScheduleItem): boolean {
  return item.recurringUntilMonths != null && item.intervalDays != null;
}

export function getRowStatus(
  item: VaccinationScheduleItem,
  dob: string,
  record?: ScheduleVaccinationRecord,
  refDate?: Date
): VaccinationRowStatus {
  if (item.scheduleKind === 'adult') {
    return record?.lastDate ? 'completed' : 'due';
  }

  const ageWeeks = getAgeInWeeks(dob, refDate);
  const ageMonths = getAgeInMonths(dob, refDate);

  if (isRecurringMaintenance(item)) {
    const untilMonths = item.recurringUntilMonths ?? 6;
    if (!record?.lastDate && ageMonths >= untilMonths) return 'not_applicable';
    if (record?.lastDate) {
      if (ageMonths >= untilMonths) return 'completed';
      return 'completed';
    }
    if (ageWeeks < item.minWeeks) return 'upcoming';
    if (ageWeeks <= (item.maxWeeks ?? item.minWeeks)) return 'due';
    if (ageMonths < untilMonths) return 'overdue';
    return 'not_applicable';
  }

  if (record?.lastDate) return 'completed';

  const maxWeeks = item.maxWeeks ?? item.minWeeks;
  if (ageWeeks < item.minWeeks) return 'upcoming';
  if (ageWeeks <= maxWeeks) return 'due';
  return 'overdue';
}

export function computeNextDueDate(
  item: VaccinationScheduleItem,
  dob: string,
  lastDate?: string,
  refDate?: Date
): string {
  if (item.scheduleKind === 'adult') {
    if (!lastDate) return '';
    const interval = item.intervalDays ?? 365;
    const base = parseIsoDate(lastDate);
    if (!base) return '';
    return addDays(base, interval);
  }

  if (isRecurringMaintenance(item)) {
    const untilMonths = item.recurringUntilMonths ?? 6;
    const ageMonths = getAgeInMonths(dob, refDate);
    if (!lastDate) {
      if (ageMonths >= untilMonths) return '';
      return getScheduledDueDate(dob, item.minWeeks);
    }
    if (ageMonths >= untilMonths) return '';
    const base = parseIsoDate(lastDate);
    if (!base) return '';
    return addDays(base, item.intervalDays ?? 30);
  }

  if (lastDate) {
    if (item.intervalDays && item.key.includes(':arv')) {
      const base = parseIsoDate(lastDate);
      if (!base) return '';
      return addDays(base, item.intervalDays);
    }
    return '';
  }

  return getScheduledDueDate(dob, item.minWeeks);
}

export function getEarliestUpcomingDue(
  dob: string,
  species: PetSpecies,
  records: ScheduleVaccinationRecord[],
  refDate?: Date
): string | undefined {
  if (!dob) return undefined;

  const dates: Date[] = [];
  const allItems = [...getJuvenileSchedule(species), ...getAdultSchedule(species)];

  for (const item of allItems) {
    const record = findRecordForScheduleItem(item, records);
    const status = getRowStatus(item, dob, record, refDate);

    if (status === 'not_applicable') continue;

    if (status === 'completed') {
      const next = record?.nextDueDate || computeNextDueDate(item, dob, record?.lastDate, refDate);
      if (next) {
        const d = parseIsoDate(next);
        if (d) dates.push(d);
      }
      continue;
    }

    const dueStr = computeNextDueDate(item, dob, record?.lastDate, refDate);
    if (dueStr) {
      const d = parseIsoDate(dueStr);
      if (d) dates.push(d);
    }
  }

  if (dates.length === 0) return undefined;
  dates.sort((a, b) => a.getTime() - b.getTime());
  return toIsoDate(dates[0]);
}

export type ScheduleVaccinationAlert = {
  vaccineKey: string;
  name: string;
  lastDate?: string;
  nextDueDate: string;
  status: 'upcoming' | 'overdue';
};

export function getScheduleVaccinationAlerts(
  dob: string,
  species: PetSpecies,
  records: ScheduleVaccinationRecord[],
  refDate?: Date
): { upcoming: ScheduleVaccinationAlert[]; overdue: ScheduleVaccinationAlert[] } {
  if (!dob) return { upcoming: [], overdue: [] };

  const today = startOfDay(refDate ?? new Date());
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const upcoming: ScheduleVaccinationAlert[] = [];
  const overdue: ScheduleVaccinationAlert[] = [];

  const allItems = [...getJuvenileSchedule(species), ...getAdultSchedule(species)];

  for (const item of allItems) {
    const record = findRecordForScheduleItem(item, records);
    const rowStatus = getRowStatus(item, dob, record, refDate);
    if (rowStatus === 'completed' || rowStatus === 'not_applicable') {
      const next =
        record?.nextDueDate || computeNextDueDate(item, dob, record?.lastDate, refDate);
      if (!next) continue;
      const due = parseIsoDate(next);
      if (!due) continue;
      if (due < today) {
        overdue.push({
          vaccineKey: item.key,
          name: item.displayName,
          lastDate: record?.lastDate,
          nextDueDate: next,
          status: 'overdue',
        });
      } else if (due <= thirtyDaysFromNow) {
        upcoming.push({
          vaccineKey: item.key,
          name: item.displayName,
          lastDate: record?.lastDate,
          nextDueDate: next,
          status: 'upcoming',
        });
      }
      continue;
    }

    const dueStr = computeNextDueDate(item, dob, record?.lastDate, refDate);
    if (!dueStr) continue;
    const due = parseIsoDate(dueStr);
    if (!due) continue;

    const alert: ScheduleVaccinationAlert = {
      vaccineKey: item.key,
      name: item.displayName,
      lastDate: record?.lastDate,
      nextDueDate: dueStr,
      status: due < today ? 'overdue' : 'upcoming',
    };

    if (due < today) overdue.push(alert);
    else if (due <= thirtyDaysFromNow) upcoming.push(alert);
  }

  upcoming.sort(
    (a, b) => parseIsoDate(a.nextDueDate)!.getTime() - parseIsoDate(b.nextDueDate)!.getTime()
  );
  overdue.sort(
    (a, b) => parseIsoDate(a.nextDueDate)!.getTime() - parseIsoDate(b.nextDueDate)!.getTime()
  );

  return { upcoming, overdue };
}

export function statusBadgeLabel(status: VaccinationRowStatus): string {
  switch (status) {
    case 'upcoming':
      return 'Upcoming';
    case 'due':
      return 'Due now';
    case 'overdue':
      return 'Overdue';
    case 'completed':
      return 'Recorded';
    case 'not_applicable':
      return 'Not applicable';
    default:
      return '';
  }
}

export function statusBadgeClass(status: VaccinationRowStatus): string {
  switch (status) {
    case 'upcoming':
      return 'bg-blue-100 text-blue-800';
    case 'due':
      return 'bg-amber-100 text-amber-800';
    case 'overdue':
      return 'bg-red-100 text-red-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'not_applicable':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}
