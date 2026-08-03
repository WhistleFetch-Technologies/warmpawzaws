/**
 * Client-side validation for required pet profile fields on create.
 * Mirrors backend/lambda/src/utils/pet-create-validation.ts rules.
 */

const ALLOWED_GENDERS = ['male', 'female', 'neutered', 'spayed'];

export type PetRequiredFieldErrors = Record<string, string>;

export type PetRequiredFieldsInput = {
  name: string;
  type: string;
  breed: string;
  dateOfBirth: string;
  gender: string;
  photo: string;
};

/**
 * Returns a map of field keys to error messages. Empty object means valid.
 */
export function validateRequiredPetFields(
  petData: PetRequiredFieldsInput,
  photoPreview?: string | null,
): PetRequiredFieldErrors {
  const errors: PetRequiredFieldErrors = {};

  if (!petData.photo && !photoPreview) {
    errors.photo = 'Photo is required';
  }

  if (!petData.type?.trim()) {
    errors.type = 'Pet type is required';
  } else {
    const type = petData.type.trim().toLowerCase();
    if (type !== 'dog' && type !== 'cat') {
      errors.type = 'Pet type must be Dog or Cat';
    }
  }

  if (!petData.name?.trim()) {
    errors.name = 'Name is required';
  }

  if (!petData.breed?.trim()) {
    errors.breed = 'Breed is required';
  }

  if (!petData.dateOfBirth?.trim()) {
    errors.dateOfBirth = 'Date of birth is required';
  } else {
    const d = new Date(petData.dateOfBirth);
    if (Number.isNaN(d.getTime())) {
      errors.dateOfBirth = 'Date of birth is invalid';
    }
  }

  if (!petData.gender?.trim()) {
    errors.gender = 'Gender is required';
  } else if (!ALLOWED_GENDERS.includes(petData.gender.trim().toLowerCase())) {
    errors.gender = 'Gender is required';
  }

  return errors;
}

export function hasRequiredPetFieldErrors(errors: PetRequiredFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
