/**
 * Helpers for loyalty action_sources on pet vaccination updates (pet profile, not booking prescriptions).
 */

type JsonObj = Record<string, unknown>;

function vaccinationEntriesFromPayload(petData: JsonObj): unknown[] | null {
  const direct = petData.vaccinations;
  if (Array.isArray(direct)) return direct;
  const mh = petData.medicalHistory ?? petData.medical_history;
  if (mh && typeof mh === 'object' && Array.isArray((mh as JsonObj).vaccinations)) {
    return (mh as JsonObj).vaccinations as unknown[];
  }
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return [direct];
  }
  return null;
}

/** True when the request body includes at least one vaccination date/name. */
export function petPayloadHasVaccinations(petData: JsonObj): boolean {
  const entries = vaccinationEntriesFromPayload(petData);
  if (!entries || entries.length === 0) return false;
  return entries.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const o = entry as JsonObj;
    const date = o.date ?? o.lastDate ?? o.administeredDate;
    const name = o.name ?? o.type ?? o.vaccineKey;
    return (
      (typeof date === 'string' && date.trim().length > 0) ||
      (typeof name === 'string' && name.trim().length > 0)
    );
  });
}

function snapshotVaccinations(pet: JsonObj): string {
  const mh = pet.medical_history ?? pet.medicalHistory;
  const fromMh =
    mh && typeof mh === 'object' ? (mh as JsonObj).vaccinations : undefined;
  const fromRecords = pet.vaccination_records ?? pet.vaccinationRecords;
  return JSON.stringify(fromMh ?? fromRecords ?? []);
}

/** True when vaccinations in DB changed and the new snapshot is non-empty. */
export function petVaccinationsMeaningfullyUpdated(
  beforePet: JsonObj,
  afterPet: JsonObj,
  payloadHadVaccinations: boolean
): boolean {
  if (!payloadHadVaccinations) return false;
  const before = snapshotVaccinations(beforePet);
  const after = snapshotVaccinations(afterPet);
  if (after === '[]' || after === '{}' || after === 'null') return false;
  return before !== after;
}
