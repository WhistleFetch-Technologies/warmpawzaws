/**
 * Daily vaccination reminder processor — notify customers 1 calendar day before due date (IST).
 */

import { query } from '../database/rds-connection';
import { sendEventNotification } from '../aws/aws-sns-notification-service';
import {
  collectVaccinationRemindersDueTomorrow,
  getIstCalendarDateIso,
  getIstTomorrowDateIso,
  VACCINATION_REMINDER_DEEP_LINK,
  type VaccinationReminderCandidate,
} from './pet-vaccination-reminder-collect';
import { petHasVaccinationScheduleInputs } from './pet-vaccination-records-extract';

export {
  collectVaccinationRemindersDueTomorrow,
  getIstCalendarDateIso,
  getIstTomorrowDateIso,
  VACCINATION_REMINDER_DEEP_LINK,
  type VaccinationReminderCandidate,
} from './pet-vaccination-reminder-collect';

export const VACCINATION_REMINDER_KIND = '1_day_before';
export const VACCINATION_REMINDER_EVENT = 'vaccination_reminder_1day';

const DEFAULT_BATCH_SIZE = 200;

export type ProcessVaccinationRemindersOptions = {
  dryRun?: boolean;
  batchSize?: number;
  customerId?: string;
  petId?: string;
  refDate?: Date;
};

export type ProcessVaccinationRemindersResult = {
  success: boolean;
  dryRun: boolean;
  refDateIso: string;
  tomorrowIso: string;
  petsScanned: number;
  candidatesFound: number;
  notificationsSent: number;
  skippedAlreadySent: number;
  skippedNoSchedule: number;
  errors: number;
  details: Array<Record<string, unknown>>;
};

async function reminderAlreadySent(
  petId: string,
  vaccineKey: string,
  dueDate: string
): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM pet_vaccination_reminder_log
     WHERE pet_id = $1 AND vaccine_key = $2 AND due_date = $3::date AND reminder_kind = $4
     LIMIT 1`,
    [petId, vaccineKey, dueDate, VACCINATION_REMINDER_KIND]
  );
  return (res.rows?.length ?? 0) > 0;
}

async function recordReminderSent(
  petId: string,
  customerId: string,
  vaccineKey: string,
  dueDate: string
): Promise<void> {
  await query(
    `INSERT INTO pet_vaccination_reminder_log (
       pet_id, customer_id, vaccine_key, due_date, reminder_kind
     ) VALUES ($1, $2, $3, $4::date, $5)
     ON CONFLICT (pet_id, vaccine_key, due_date, reminder_kind) DO NOTHING`,
    [petId, customerId, vaccineKey, dueDate, VACCINATION_REMINDER_KIND]
  );
}

async function deliverVaccinationReminder(
  candidate: VaccinationReminderCandidate
): Promise<boolean> {
  return sendEventNotification({
    eventType: VACCINATION_REMINDER_EVENT,
    recipientId: candidate.customerId,
    recipientType: 'customer',
    relatedId: candidate.petId,
    data: {
      petId: candidate.petId,
      petName: candidate.petName,
      vaccineKey: candidate.vaccineKey,
      vaccineName: candidate.vaccineName,
      dueDate: candidate.dueDate,
      deep_link: VACCINATION_REMINDER_DEEP_LINK,
      deepLink: VACCINATION_REMINDER_DEEP_LINK,
      dedupeKey: `vax-${candidate.petId}-${candidate.vaccineKey}-${candidate.dueDate}-1d`,
    },
  });
}

export async function processVaccinationReminders(
  options: ProcessVaccinationRemindersOptions = {}
): Promise<ProcessVaccinationRemindersResult> {
  const refDate = options.refDate ?? new Date();
  const dryRun = Boolean(options.dryRun);
  const batchSize = Math.min(Math.max(options.batchSize ?? DEFAULT_BATCH_SIZE, 1), 500);
  const tomorrowIso = getIstTomorrowDateIso(refDate);

  const result: ProcessVaccinationRemindersResult = {
    success: true,
    dryRun,
    refDateIso: getIstCalendarDateIso(refDate),
    tomorrowIso,
    petsScanned: 0,
    candidatesFound: 0,
    notificationsSent: 0,
    skippedAlreadySent: 0,
    skippedNoSchedule: 0,
    errors: 0,
    details: [],
  };

  let offset = 0;
  for (;;) {
    const params: unknown[] = [batchSize, offset];
    let where = 'WHERE p.customer_id IS NOT NULL';
    if (options.customerId) {
      params.push(options.customerId);
      where += ` AND p.customer_id = $${params.length}`;
    }
    if (options.petId) {
      params.push(options.petId);
      where += ` AND p.id = $${params.length}`;
    }

    const page = await query(
      `SELECT p.id, p.name, p.species, p.medical_history, p.vaccination_records, p.customer_id
       FROM pets p
       ${where}
       ORDER BY p.id
       LIMIT $1 OFFSET $2`,
      params
    );

    const rows = page.rows ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      result.petsScanned += 1;
      const pet = row as {
        id: string;
        name: string;
        species: unknown;
        medical_history?: Record<string, unknown> | null;
        vaccination_records?: unknown;
        customer_id: string;
      };

      if (!petHasVaccinationScheduleInputs(pet)) {
        result.skippedNoSchedule += 1;
        continue;
      }

      const candidates = collectVaccinationRemindersDueTomorrow(pet, refDate).map((c) => ({
        ...c,
        customerId: String(pet.customer_id),
      }));

      result.candidatesFound += candidates.length;

      for (const candidate of candidates) {
        try {
          const already = await reminderAlreadySent(
            candidate.petId,
            candidate.vaccineKey,
            candidate.dueDate
          );
          if (already) {
            result.skippedAlreadySent += 1;
            continue;
          }

          if (dryRun) {
            result.details.push({
              dryRun: true,
              petId: candidate.petId,
              customerId: candidate.customerId,
              vaccineKey: candidate.vaccineKey,
              dueDate: candidate.dueDate,
            });
            continue;
          }

          const sent = await deliverVaccinationReminder(candidate);
          if (sent) {
            await recordReminderSent(
              candidate.petId,
              candidate.customerId,
              candidate.vaccineKey,
              candidate.dueDate
            );
            result.notificationsSent += 1;
            result.details.push({
              sent: true,
              petId: candidate.petId,
              vaccineKey: candidate.vaccineKey,
            });
          } else {
            result.errors += 1;
          }
        } catch (err) {
          result.errors += 1;
          console.error('[vaccination-reminder] candidate failed', {
            petId: candidate.petId,
            vaccineKey: candidate.vaccineKey,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    offset += rows.length;
    if (rows.length < batchSize) break;
    if (options.petId) break;
  }

  return result;
}

export async function getUpcomingVaccinationRemindersForCustomer(
  customerId: string,
  refDate: Date = new Date()
): Promise<VaccinationReminderCandidate[]> {
  const res = await query(
    `SELECT id, name, species, medical_history, vaccination_records, customer_id
     FROM pets WHERE customer_id = $1 ORDER BY created_at DESC`,
    [customerId]
  );
  const tomorrowIso = getIstTomorrowDateIso(refDate);
  const all: VaccinationReminderCandidate[] = [];

  for (const row of res.rows ?? []) {
    const pet = row as {
      id: string;
      name: string;
      species: unknown;
      medical_history?: Record<string, unknown> | null;
      vaccination_records?: unknown;
      customer_id: string;
    };
    const candidates = collectVaccinationRemindersDueTomorrow(pet, refDate).map((c) => ({
      ...c,
      customerId: String(pet.customer_id),
    }));
    all.push(...candidates.filter((c) => c.dueDate === tomorrowIso));
  }

  return all;
}
