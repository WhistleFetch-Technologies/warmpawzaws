/**
 * Persist at most one certificate imageKey per vaccination array entry.
 * Strip keys/URLs from non-owner responses; owner GET/PUT get presigned imageUrl.
 */

import { randomUUID } from 'crypto';
import { urlForImageKey } from '../services/image/image-url-builder';

export const VACCINE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CUSTOM_VACCINE_KEY_PREFIX = 'custom:';

const IMAGE_KEY_FIELDS = ['imageKey', 'image_key', 'certificateKey', 'certificate_key'] as const;
const IMAGE_URL_FIELDS = [
  'imageUrl',
  'image_url',
  'certificateUrl',
  'certificate_url',
  'photoUrl',
  'photo_url',
] as const;

export type OwnerVaccinationEntry = {
  id?: string;
  key?: string;
  name: string;
  date: string;
  nextDue?: string;
  imageUrl?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickString(rec: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function hasDate(rec: Record<string, unknown>): boolean {
  return Boolean(pickString(rec, ['date', 'lastDate', 'administered_date', 'administeredDate']));
}

function normalizeStoredImageKey(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const path = decodeURIComponent(url.pathname.replace(/^\//, ''));
      return path || undefined;
    } catch {
      return undefined;
    }
  }
  return trimmed.replace(/^\/+/, '');
}

function extractImageKey(rec: Record<string, unknown>): string | undefined {
  const raw = pickString(rec, [...IMAGE_KEY_FIELDS]);
  return raw ? normalizeStoredImageKey(raw) : undefined;
}

function incomingImageKeyState(rec: Record<string, unknown>): 'absent' | 'clear' | 'set' {
  const present = IMAGE_KEY_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(rec, field));
  if (!present) return 'absent';
  return extractImageKey(rec) ? 'set' : 'clear';
}

function stripImageFields(rec: Record<string, unknown>): Record<string, unknown> {
  const out = { ...rec };
  for (const field of [...IMAGE_KEY_FIELDS, ...IMAGE_URL_FIELDS, 'photo']) {
    delete out[field];
  }
  return out;
}

function copyScalar(out: Record<string, unknown>, rec: Record<string, unknown>, key: string): void {
  if (!Object.prototype.hasOwnProperty.call(rec, key)) return;
  const value = rec[key];
  if (value == null) return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    out[key] = typeof value === 'string' ? value.trim() : value;
  }
}

export function vaccinationOwnerId(petId: string, entryId: string): string {
  return `${String(petId).trim()}-vax-${String(entryId).trim()}`;
}

export function vaccinationIdentity(entry: Record<string, unknown>): string {
  const id = pickString(entry, ['id']);
  if (id) return `id:${id}`;
  const key = pickString(entry, ['vaccineKey', 'key']);
  if (key) return `key:${key}`;
  const name = (pickString(entry, ['name', 'type', 'payloadName']) || '').toLowerCase();
  const date = pickString(entry, ['date', 'lastDate']) || '';
  return `name:${name}|${date}`;
}

function sanitizeEntry(
  entry: unknown,
  opts: { assignMissingIds: boolean; persistImageKey: boolean },
): Record<string, unknown> | null {
  if (!isRecord(entry)) return null;
  const name = pickString(entry, ['name', 'type', 'payloadName']) || 'Vaccination';
  const date = pickString(entry, ['date', 'lastDate', 'administered_date', 'administeredDate']);
  if (!date) return null;

  const out: Record<string, unknown> = {
    name,
    type: pickString(entry, ['type']) || name,
    date,
    lastDate: pickString(entry, ['lastDate']) || date,
  };

  copyScalar(out, entry, 'nextDue');
  copyScalar(out, entry, 'nextDueDate');
  if (!out.nextDue && out.nextDueDate) out.nextDue = out.nextDueDate;
  if (!out.nextDueDate && out.nextDue) out.nextDueDate = out.nextDue;

  const id = pickString(entry, ['id']);
  const vaccineKey = pickString(entry, ['vaccineKey', 'key']);
  if (id) out.id = id;
  else if (opts.assignMissingIds) out.id = `vax_${randomUUID()}`;

  if (vaccineKey) {
    out.vaccineKey = vaccineKey;
    out.key = vaccineKey;
  } else if (opts.assignMissingIds) {
    const customKey = `${CUSTOM_VACCINE_KEY_PREFIX}${randomUUID()}`;
    out.vaccineKey = customKey;
    out.key = customKey;
  }

  copyScalar(out, entry, 'veterinarian');
  copyScalar(out, entry, 'batchNumber');
  copyScalar(out, entry, 'notes');

  if (opts.persistImageKey) {
    const imageKey = extractImageKey(entry);
    if (imageKey) out.imageKey = imageKey;
  }

  return out;
}

export function sanitizeVaccinationArrayForStorage(incoming: unknown): Record<string, unknown>[] {
  return asArray(incoming)
    .map((entry) => sanitizeEntry(entry, { assignMissingIds: false, persistImageKey: true }))
    .filter((entry): entry is Record<string, unknown> => entry != null);
}

export function sanitizeVaccinationsForCreate(incoming: unknown): Record<string, unknown>[] {
  return asArray(incoming)
    .map((entry) => sanitizeEntry(entry, { assignMissingIds: true, persistImageKey: true }))
    .filter((entry): entry is Record<string, unknown> => entry != null);
}

function findMatchIndex(
  existing: Record<string, unknown>[],
  incoming: Record<string, unknown>,
  used: Set<number>,
): number {
  const incomingId = pickString(incoming, ['id']);
  if (incomingId) {
    const byId = existing.findIndex((row, index) => !used.has(index) && pickString(row, ['id']) === incomingId);
    if (byId >= 0) return byId;
  }
  const incomingKey = pickString(incoming, ['vaccineKey', 'key']);
  if (incomingKey) {
    const byKey = existing.findIndex(
      (row, index) => !used.has(index) && pickString(row, ['vaccineKey', 'key']) === incomingKey,
    );
    if (byKey >= 0) return byKey;
  }
  const incomingName = (pickString(incoming, ['name', 'type']) || '').toLowerCase();
  if (!incomingName) return -1;
  return existing.findIndex((row, index) => {
    if (used.has(index)) return false;
    const name = (pickString(row, ['name', 'type']) || '').toLowerCase();
    return name === incomingName;
  });
}

function mergeMatchedEntry(
  previous: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged = sanitizeEntry(
    { ...previous, ...incoming, imageKey: previous.imageKey },
    { assignMissingIds: false, persistImageKey: true },
  );
  const out = merged || { ...previous };
  const imageState = incomingImageKeyState(incoming);
  if (imageState === 'clear') {
    delete out.imageKey;
  } else if (imageState === 'set') {
    out.imageKey = extractImageKey(incoming);
  }
  return out;
}

/** Update existing rows and append newly added vaccines (dates + optional imageKey). */
export function mergeVaccinationArrayForUpdate(
  existing: unknown,
  incoming: unknown,
): Record<string, unknown>[] {
  const existingRows = sanitizeVaccinationArrayForStorage(existing);
  const used = new Set<number>();
  const result: Record<string, unknown>[] = [];

  for (const raw of asArray(incoming)) {
    if (!isRecord(raw) || !hasDate(raw)) continue;
    const matchIndex = findMatchIndex(existingRows, raw, used);
    if (matchIndex >= 0) {
      used.add(matchIndex);
      result.push(mergeMatchedEntry(existingRows[matchIndex], raw));
      continue;
    }
    const created = sanitizeEntry(raw, { assignMissingIds: true, persistImageKey: true });
    if (created) result.push(created);
  }

  return result;
}

export function stripVaccinationImagesFromHistory(history: unknown): Record<string, unknown> {
  if (!isRecord(history)) return {};
  const out = { ...history };
  if (Array.isArray(out.vaccinations)) {
    out.vaccinations = out.vaccinations.map((entry) =>
      isRecord(entry) ? stripImageFields(entry) : entry,
    );
  }
  return out;
}

export function stripVaccinationImagesFromValue(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((entry) => (isRecord(entry) ? stripImageFields(entry) : entry));
}

export function stripVaccinationImagesFromPetRow<T extends Record<string, unknown>>(pet: T): T {
  const out = { ...pet };
  if (out.medical_history != null) {
    (out as Record<string, unknown>).medical_history = stripVaccinationImagesFromHistory(out.medical_history);
  }
  if (Array.isArray(out.vaccination_records)) {
    (out as Record<string, unknown>).vaccination_records = stripVaccinationImagesFromValue(
      out.vaccination_records,
    );
  }
  return out;
}

export async function mapOwnerVaccinationEntries(pet: {
  id?: string;
  medical_history?: unknown;
}): Promise<OwnerVaccinationEntry[]> {
  const history = isRecord(pet.medical_history) ? pet.medical_history : {};
  const out: OwnerVaccinationEntry[] = [];
  for (const entry of asArray(history.vaccinations)) {
    if (!isRecord(entry)) continue;
    const date = pickString(entry, ['date', 'lastDate', 'administered_date', 'administeredDate']);
    if (!date) continue;
    const imageKey = extractImageKey(entry);
    const imageUrl = imageKey ? (await urlForImageKey(imageKey)) || undefined : undefined;
    const nextDue = pickString(entry, ['nextDue', 'nextDueDate']);
    out.push({
      id: pickString(entry, ['id']),
      key: pickString(entry, ['vaccineKey', 'key']),
      name: pickString(entry, ['name', 'type', 'payloadName']) || 'Vaccination',
      date,
      ...(nextDue ? { nextDue } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    });
  }
  return out;
}

export async function ownerVaccinationResponseFields(pet: {
  id?: string;
  medical_history?: unknown;
}): Promise<{
  medical_history: Record<string, unknown>;
  vaccinationEntries: OwnerVaccinationEntry[];
}> {
  const vaccinationEntries = await mapOwnerVaccinationEntries(pet);
  return {
    medical_history: stripVaccinationImagesFromHistory(pet.medical_history),
    vaccinationEntries,
  };
}
