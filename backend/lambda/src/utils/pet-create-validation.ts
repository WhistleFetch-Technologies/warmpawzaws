/**
 * Shared validation for pet profile creation (POST /pets and related create paths).
 */

const ALLOWED_PET_TYPES = ['dog', 'cat'];
const ALLOWED_GENDERS = ['male', 'female', 'neutered', 'spayed'];

export type PetCreateValidationResult =
  | { ok: true }
  | { ok: false; error: string };

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolvePetType(payload: Record<string, unknown>): string | null {
  const raw = payload.petType ?? payload.species ?? payload.type;
  if (!nonEmptyString(raw)) return null;
  return raw.trim();
}

function resolvePhoto(payload: Record<string, unknown>): string | null {
  if (nonEmptyString(payload.photo)) return payload.photo.trim();
  if (nonEmptyString(payload.profile_photo_url)) return payload.profile_photo_url.trim();
  const photos = payload.photos;
  if (Array.isArray(photos) && photos.length > 0 && nonEmptyString(photos[0])) {
    return photos[0].trim();
  }
  return null;
}

function resolveDobOrAge(payload: Record<string, unknown>): boolean {
  const dob = payload.dob ?? payload.dateOfBirth ?? payload.date_of_birth;
  if (nonEmptyString(dob)) {
    const d = new Date(dob);
    if (!Number.isNaN(d.getTime())) return true;
  }
  const age = payload.age;
  if (age != null && age !== '') {
    const n = typeof age === 'number' ? age : parseInt(String(age), 10);
    if (!Number.isNaN(n) && n >= 0) return true;
  }
  return false;
}

function resolveGender(payload: Record<string, unknown>): string | null {
  const raw = payload.gender;
  if (!nonEmptyString(raw)) return null;
  const normalized = raw.trim().toLowerCase();
  return ALLOWED_GENDERS.includes(normalized) ? normalized : null;
}

export type ValidatePetCreateOptions = {
  /** When true (default), customerId must be present on the payload. */
  requireCustomerId?: boolean;
};

/**
 * Validates required fields for creating a new pet profile.
 * Optional fields (weight, color, health, etc.) are not checked.
 */
export function validatePetCreatePayload(
  payload: Record<string, unknown>,
  options: ValidatePetCreateOptions = {},
): PetCreateValidationResult {
  const requireCustomerId = options.requireCustomerId !== false;

  if (requireCustomerId) {
    const customerId = payload.customerId ?? payload.customer_id;
    if (!nonEmptyString(customerId)) {
      return { ok: false, error: 'customerId is required' };
    }
  }

  if (!nonEmptyString(payload.name)) {
    return { ok: false, error: 'Pet name is required' };
  }

  const petType = resolvePetType(payload);
  if (!petType) {
    return { ok: false, error: 'Pet type is required' };
  }
  if (!ALLOWED_PET_TYPES.includes(petType.toLowerCase())) {
    return {
      ok: false,
      error: 'Invalid pet type. Platform currently supports Dogs and Cats only.',
    };
  }

  if (!nonEmptyString(payload.breed)) {
    return { ok: false, error: 'Breed is required' };
  }

  if (!resolveGender(payload)) {
    return {
      ok: false,
      error: 'Gender is required (male, female, neutered, or spayed)',
    };
  }

  if (!resolveDobOrAge(payload)) {
    return { ok: false, error: 'Date of birth or age is required' };
  }

  if (!resolvePhoto(payload)) {
    return { ok: false, error: 'Profile photo is required' };
  }

  return { ok: true };
}
