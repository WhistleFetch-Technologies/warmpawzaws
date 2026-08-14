/**
 * Completeness check for complete_pet_profile loyalty (vaccination excluded).
 */

const ALLOWED_TYPES = ['dog', 'cat'];
const ALLOWED_GENDERS = ['male', 'female', 'neutered', 'spayed'];
const ONBOARDING_PLACEHOLDER_NAME = 'my pet';

type JsonObj = Record<string, unknown>;

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asObj(value: unknown): JsonObj | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObj)
    : null;
}

function resolveName(pet: JsonObj): string | null {
  if (!nonEmptyString(pet.name)) return null;
  const name = pet.name.trim();
  if (name.toLowerCase() === ONBOARDING_PLACEHOLDER_NAME) return null;
  return name;
}

function resolveSpecies(pet: JsonObj): string | null {
  const raw = pet.species ?? pet.petType ?? pet.type;
  if (!nonEmptyString(raw)) return null;
  const normalized = raw.trim().toLowerCase();
  return ALLOWED_TYPES.includes(normalized) ? normalized : null;
}

function resolveBreed(pet: JsonObj): string | null {
  if (!nonEmptyString(pet.breed)) return null;
  return pet.breed.trim();
}

function resolveGender(pet: JsonObj): string | null {
  if (!nonEmptyString(pet.gender)) return null;
  const normalized = pet.gender.trim().toLowerCase();
  return ALLOWED_GENDERS.includes(normalized) ? normalized : null;
}

function resolvePhoto(pet: JsonObj): string | null {
  if (nonEmptyString(pet.profile_photo_url)) return pet.profile_photo_url.trim();
  if (nonEmptyString(pet.photo)) return pet.photo.trim();
  const photos = pet.photos;
  if (Array.isArray(photos) && photos.length > 0 && nonEmptyString(photos[0])) {
    return photos[0].trim();
  }
  return null;
}

function resolveHasDobOrAge(pet: JsonObj): boolean {
  const mh = asObj(pet.medical_history) ?? asObj(pet.medicalHistory);
  const dob =
    pet.dob ??
    pet.dateOfBirth ??
    pet.date_of_birth ??
    mh?.dob ??
    mh?.dateOfBirth ??
    mh?.date_of_birth;
  if (nonEmptyString(dob)) {
    const d = new Date(dob);
    if (!Number.isNaN(d.getTime())) return true;
  }

  const ageYears = pet.age_years ?? pet.ageYears;
  const ageMonths = pet.age_months ?? pet.ageMonths;
  const age = pet.age;
  for (const value of [ageYears, ageMonths, age]) {
    if (value == null || value === '') continue;
    const n = typeof value === 'number' ? value : parseInt(String(value), 10);
    if (!Number.isNaN(n) && n >= 0) return true;
  }
  return false;
}

/** True when the saved pet has all required non-vaccination profile fields. */
export function isPetProfileComplete(pet: JsonObj | null | undefined): boolean {
  if (!pet || typeof pet !== 'object') return false;
  if (!resolveName(pet)) return false;
  if (!resolveSpecies(pet)) return false;
  if (!resolveBreed(pet)) return false;
  if (!resolveGender(pet)) return false;
  if (!resolvePhoto(pet)) return false;
  if (!resolveHasDobOrAge(pet)) return false;
  return true;
}
