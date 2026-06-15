import type { LucideIcon } from 'lucide-react';
import {
  FlaskConical,
  Sun,
  Heart,
  FileText,
  Dog,
  Activity,
  AlertTriangle,
  Pill,
  UtensilsCrossed,
  Calendar,
} from 'lucide-react';

export const NUTRITION_IMG = '/images/home/Nutrition';

/** Dog + cat composite for header hero (no dedicated nutrition header asset yet). */
export const NUTRITION_HEADER_BANNER = `${NUTRITION_IMG}/prescription-diet.webp`;

export type NutritionNeedCardDef = {
  id: string;
  name: string;
  image: string;
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  aliases?: string[];
};

export const NUTRITION_NEED_CARDS: NutritionNeedCardDef[] = [
  {
    id: 'lab_diagnostics',
    name: 'Lab & Diagnostics',
    image: `${NUTRITION_IMG}/lab-diagonosis.webp`,
    Icon: FlaskConical,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    aliases: ['lab_diagnosis', 'lab_diagonosis'],
  },
  {
    id: 'palliative',
    name: 'Palliative & End-of-Life Care',
    image: `${NUTRITION_IMG}/palliative.webp`,
    Icon: Sun,
    iconColor: 'text-pink-600',
    iconBg: 'bg-pink-100',
  },
  {
    id: 'reproductive',
    name: 'Reproductive & Breeding',
    image: `${NUTRITION_IMG}/productive.webp`,
    Icon: Heart,
    iconColor: 'text-pink-600',
    iconBg: 'bg-pink-100',
    aliases: ['productive', 'breeding'],
  },
  {
    id: 'diet_plan',
    name: 'Custom Diet Plans',
    image: `${NUTRITION_IMG}/custom-diet.webp`,
    Icon: FileText,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
    aliases: ['custom_diet', 'diet_planning'],
  },
  {
    id: 'puppy_nutrition',
    name: 'Puppy Nutrition',
    image: `${NUTRITION_IMG}/puppy-nutrition.webp`,
    Icon: Dog,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    aliases: ['puppy_diet'],
  },
  {
    id: 'senior_nutrition',
    name: 'Senior Pet Nutrition',
    image: `${NUTRITION_IMG}/senior-pet-nutrition.webp`,
    Icon: Heart,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-100',
    aliases: ['senior_diet'],
  },
  {
    id: 'weight_management',
    name: 'Weight Management',
    image: `${NUTRITION_IMG}/weight-measurment.webp`,
    Icon: Activity,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-100',
    aliases: ['weight_loss', 'weight_measurement'],
  },
  {
    id: 'allergies',
    name: 'Allergy Diet',
    image: `${NUTRITION_IMG}/allergy-diet.webp`,
    Icon: AlertTriangle,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-100',
    aliases: ['allergy_diet', 'food_allergies'],
  },
  {
    id: 'special_diet',
    name: 'Prescription Diet',
    image: `${NUTRITION_IMG}/prescription-diet.webp`,
    Icon: Pill,
    iconColor: 'text-teal-600',
    iconBg: 'bg-teal-100',
    aliases: ['prescription_diet', 'medical_diet'],
  },
];

export const NUTRITION_SERVICE_CARDS = [
  {
    id: 'diet_consultation',
    label: 'Diet Consultation',
    description: 'Personalized meal plans for your pet',
    image: `${NUTRITION_IMG}/diet-consultation.webp`,
    Icon: UtensilsCrossed,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
    cardBg: 'bg-gradient-to-br from-green-50/90 to-emerald-50/50',
    borderClass: 'border-green-100',
    ctaClass: 'text-green-700',
  },
  {
    id: 'meal_plans',
    label: 'Meal Plans',
    description: 'Complete balanced meal plans',
    image: `${NUTRITION_IMG}/meal-plans.webp`,
    Icon: Calendar,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100',
    cardBg: 'bg-gradient-to-br from-amber-50/90 to-orange-50/50',
    borderClass: 'border-amber-100',
    ctaClass: 'text-amber-800',
  },
] as const;

const NEED_IMAGE_BY_KEY = new Map<string, string>();
const NEED_NAME_BY_KEY = new Map<string, string>();
const NEED_ICON_BY_KEY = new Map<string, NutritionNeedCardDef>();

for (const card of NUTRITION_NEED_CARDS) {
  const keys = [card.id, ...(card.aliases ?? [])].map((k) => k.toLowerCase());
  for (const k of keys) {
    NEED_IMAGE_BY_KEY.set(k, card.image);
    NEED_NAME_BY_KEY.set(k, card.name);
    NEED_ICON_BY_KEY.set(k, card);
  }
}

export function nutritionNeedImageForId(problemId: string): string | undefined {
  return NEED_IMAGE_BY_KEY.get(problemId.toLowerCase());
}

export function nutritionNeedCardForId(problemId: string): NutritionNeedCardDef | undefined {
  return NEED_ICON_BY_KEY.get(problemId.toLowerCase());
}

export function isNutritionViewAllProblem(problem: { id?: string }): boolean {
  return String(problem.id ?? '').toLowerCase() === 'view_all';
}

export function resolveNutritionNeedDisplay(
  problem: { id: string; name: string },
  index: number,
): { image: string; label: string; iconDef?: NutritionNeedCardDef } {
  const key = problem.id.toLowerCase();
  const iconDef = nutritionNeedCardForId(key);
  const image =
    nutritionNeedImageForId(key) ??
    NUTRITION_NEED_CARDS[index % NUTRITION_NEED_CARDS.length].image;
  const label = NEED_NAME_BY_KEY.get(key) ?? problem.name;
  return { image, label, iconDef };
}
