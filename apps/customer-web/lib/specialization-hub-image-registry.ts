/**
 * Resolves specialization card / hero images from existing hub asset registries.
 * Card image is preferred; category banner is the fallback when no id match exists.
 */
import { trainingGoalImageForId } from '@/components/customer/training/constants/training-hub-assets';
import { nutritionNeedImageForId } from '@/components/customer/nutrition/constants/nutrition-hub-assets';

const GROOMING_IMG = '/images/home/Grooming';
const WALKING_IMG = '/images/home/Walking';
const BOARDING_IMG = '/images/home/Boarding';
const VET_IMG = '/images/home/Vet';
const TRAINING_IMG = '/images/home/Training';
const NUTRITION_IMG = '/images/home/Nutrition';

/** Paths aligned with GroomingServiceRouter GROOMING_NEED_CARDS */
const GROOMING_CARD_IMAGES: Record<string, string> = {
  hair_trim: `${GROOMING_IMG}/hair-trim.webp`,
  bath_only: `${GROOMING_IMG}/bathnbrush.webp`,
  full_grooming: `${GROOMING_IMG}/fullbodygroom.webp`,
  nail_care: `${GROOMING_IMG}/nailtrim.webp`,
  haircut_styling: `${GROOMING_IMG}/haircut.webp`,
  deshedding: `${GROOMING_IMG}/de-shedding.webp`,
  spa_treatment: `${GROOMING_IMG}/spa.webp`,
};

/** Paths aligned with WalkerService WALKING_NEED_CARDS */
const WALKING_CARD_IMAGES: Record<string, string> = {
  daily_walk: `${WALKING_IMG}/daily-walk.jpg`,
  puppy_walk: `${WALKING_IMG}/puppy-walk.jpg`,
  multiple_dogs: `${WALKING_IMG}/group-walk.jpg`,
  senior_walk: `${WALKING_IMG}/adult-walk.jpg`,
  long_walk: `${WALKING_IMG}/adventure-walk.jpg`,
};

const BOARDING_CARD_IMAGES: Record<string, string> = {
  daycare: `${BOARDING_IMG}/half-day.webp`,
  short_stay: `${BOARDING_IMG}/overnight.webp`,
  long_stay: `${BOARDING_IMG}/weekly-board.webp`,
  luxury_boarding: `${BOARDING_IMG}/header-img.webp`,
  medical_boarding: `${BOARDING_IMG}/header-img.webp`,
};

const CATEGORY_BANNER_IMAGES: Record<string, string> = {
  training: `${TRAINING_IMG}/header.webp`,
  trainer: `${TRAINING_IMG}/header.webp`,
  behavioral: `${TRAINING_IMG}/separation-anxiety.webp`,
  behavior: `${TRAINING_IMG}/separation-anxiety.webp`,
  sub_behavior: `${TRAINING_IMG}/separation-anxiety.webp`,
  behaviourist: `${TRAINING_IMG}/separation-anxiety.webp`,
  behaviorist: `${TRAINING_IMG}/separation-anxiety.webp`,
  walker: `${WALKING_IMG}/daily-walk.jpg`,
  walking: `${WALKING_IMG}/daily-walk.jpg`,
  grooming: `${GROOMING_IMG}/banner-img.webp`,
  groomer: `${GROOMING_IMG}/banner-img.webp`,
  boarding: `${BOARDING_IMG}/header-img.webp`,
  nutrition: `${NUTRITION_IMG}/banner-img.webp`,
  nutritionist: `${NUTRITION_IMG}/banner-img.webp`,
  wellness: `${NUTRITION_IMG}/banner-img.webp`,
  vet: `${VET_IMG}/banner-dog-and-cat.webp`,
  veterinarian: `${VET_IMG}/banner-dog-and-cat.webp`,
};

function lookupCardImage(id: string): string | undefined {
  const key = id.toLowerCase();
  return (
    trainingGoalImageForId(key) ??
    nutritionNeedImageForId(key) ??
    GROOMING_CARD_IMAGES[key] ??
    WALKING_CARD_IMAGES[key] ??
    BOARDING_CARD_IMAGES[key]
  );
}

/** Specialization grid / hub card image for an id (no category fallback). */
export function resolveSpecializationCardImage(id: string): string | undefined {
  return lookupCardImage(id);
}

/** Hero image: card image first, then category banner, then platform default. */
export function resolveSpecializationHeroImage(id: string, category: string): string {
  const card = lookupCardImage(id);
  if (card) return card;
  const cat = category.toLowerCase();
  return CATEGORY_BANNER_IMAGES[cat] ?? `${TRAINING_IMG}/header.webp`;
}
