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

export type ValidatePetFieldsOptions = {
  /** When true (default), all core fields are required. */
  strict?: boolean;
};

export type MeaningfulPetInput = {
  name?: string;
  type?: string;
  breed?: string;
  dateOfBirth?: string;
  gender?: string;
  weight?: string;
  color?: string;
  photo?: string;
  microchipId?: string;
  registrationNumber?: string;
  coatType?: string;
  eyeColor?: string;
  distinguishingMarks?: string;
  bloodType?: string;
  allergies?: string[];
  currentMedications?: string[];
  chronicConditions?: string[];
  dietaryRestrictions?: string;
  vaccinations?: Array<{ name?: string; lastDate?: string; date?: string }>;
  temperament?: string;
  specialNeeds?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  emergencyVetName?: string;
  emergencyVetPhone?: string;
  isSpayedNeutered?: boolean;
  hasInsurance?: boolean;
  isGoodWithKids?: boolean;
  isGoodWithOtherPets?: boolean;
  activityLevel?: string;
};

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateFormatOnly(petData: PetRequiredFieldsInput): PetRequiredFieldErrors {
  const errors: PetRequiredFieldErrors = {};

  if (petData.type?.trim()) {
    const type = petData.type.trim().toLowerCase();
    if (type !== 'dog' && type !== 'cat') {
      errors.type = 'Pet type must be Dog or Cat';
    }
  }

  if (petData.dateOfBirth?.trim()) {
    const d = new Date(petData.dateOfBirth);
    if (Number.isNaN(d.getTime())) {
      errors.dateOfBirth = 'Date of birth is invalid';
    }
  }

  if (petData.gender?.trim()) {
    if (!ALLOWED_GENDERS.includes(petData.gender.trim().toLowerCase())) {
      errors.gender = 'Gender is invalid';
    }
  }

  return errors;
}

/**
 * Returns a map of field keys to error messages. Empty object means valid.
 */
export function validateRequiredPetFields(
  petData: PetRequiredFieldsInput,
  photoPreview?: string | null,
  options: ValidatePetFieldsOptions = {},
): PetRequiredFieldErrors {
  const strict = options.strict !== false;

  if (!strict) {
    return validateFormatOnly(petData);
  }

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

/**
 * True when the user entered anything beyond wizard defaults (onboarding empty-save guard).
 */
export function hasMeaningfulPetInput(
  petData: MeaningfulPetInput,
  photoPreview?: string | null,
): boolean {
  if (nonEmpty(petData.photo) || nonEmpty(photoPreview)) return true;
  if (nonEmpty(petData.name)) return true;
  if (nonEmpty(petData.breed)) return true;
  if (nonEmpty(petData.dateOfBirth)) return true;
  if (nonEmpty(petData.weight)) return true;
  if (nonEmpty(petData.color)) return true;
  if (nonEmpty(petData.microchipId)) return true;
  if (nonEmpty(petData.registrationNumber)) return true;
  if (nonEmpty(petData.coatType)) return true;
  if (nonEmpty(petData.eyeColor)) return true;
  if (nonEmpty(petData.distinguishingMarks)) return true;
  if (nonEmpty(petData.bloodType)) return true;
  if (nonEmpty(petData.dietaryRestrictions)) return true;
  if (nonEmpty(petData.temperament)) return true;
  if (nonEmpty(petData.specialNeeds)) return true;
  if (nonEmpty(petData.insuranceProvider)) return true;
  if (nonEmpty(petData.insurancePolicyNumber)) return true;
  if (nonEmpty(petData.emergencyVetName)) return true;
  if (nonEmpty(petData.emergencyVetPhone)) return true;

  if ((petData.allergies?.length ?? 0) > 0) return true;
  if ((petData.currentMedications?.length ?? 0) > 0) return true;
  if ((petData.chronicConditions?.length ?? 0) > 0) return true;

  if (petData.isSpayedNeutered === true) return true;
  if (petData.hasInsurance === true) return true;
  if (petData.isGoodWithKids !== undefined) return true;
  if (petData.isGoodWithOtherPets !== undefined) return true;

  if (petData.type && petData.type !== 'Dog') return true;
  if (petData.gender && petData.gender !== 'Male') return true;
  if (petData.activityLevel && petData.activityLevel !== 'Medium') return true;

  const vaccinations = petData.vaccinations ?? [];
  if (
    vaccinations.some((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      const date = entry.lastDate ?? entry.date;
      const name = entry.name;
      return nonEmpty(date) || nonEmpty(name);
    })
  ) {
    return true;
  }

  return false;
}
