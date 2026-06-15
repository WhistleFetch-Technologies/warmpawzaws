import type { LucideIcon } from 'lucide-react';
import {
  GraduationCap,
  Home,
  PawPrint,
  Trophy,
  AlertTriangle,
  Frown,
  Volume2,
  Ghost,
  Bomb,
  Shield,
  Building2,
  Home as HomeIcon,
  Dog as DogLeash,
} from 'lucide-react';

export const TRAINING_IMG = '/images/home/Training';

export const TRAINING_HEADER_BANNER = `${TRAINING_IMG}/header.webp`;

export const TRAINING_TYPE_CARDS = [
  {
    id: 'training_center',
    name: 'Training Centre',
    description: 'Visit our facilities',
    image: `${TRAINING_IMG}/training-center.jpg`,
    Icon: Building2,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-100',
    badgeFallback: 'CENTRES',
    badgeClass: 'bg-white/95 text-slate-700',
    arrowClass: 'bg-orange-500 hover:bg-orange-600',
  },
  {
    id: 'training_home',
    name: 'At Home Training',
    description: 'Trainer comes to you',
    image: `${TRAINING_IMG}/at-home.jpg`,
    Icon: HomeIcon,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    badge: 'PERSONALIZED',
    badgeClass: 'bg-white/95 text-slate-700',
    arrowClass: 'bg-blue-500 hover:bg-blue-600',
  },
] as const;

export type TrainingGoalCardDef = {
  id: string;
  name: string;
  image: string;
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  /** Alternate API / legacy problem ids */
  aliases?: string[];
};

export const TRAINING_GOAL_CARDS: TrainingGoalCardDef[] = [
  {
    id: 'basic_obedience',
    name: 'Basic Obedience',
    image: `${TRAINING_IMG}/basic-obedience.webp`,
    Icon: GraduationCap,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-100',
  },
  {
    id: 'house_training',
    name: 'House Training',
    image: `${TRAINING_IMG}/house-training.webp`,
    Icon: Home,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
    aliases: ['potty_training'],
  },
  {
    id: 'leash_walking',
    name: 'Leash Walking',
    image: `${TRAINING_IMG}/leash-walking.webp`,
    Icon: DogLeash,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    aliases: ['leash_training'],
  },
  {
    id: 'socialization',
    name: 'Socialization',
    image: `${TRAINING_IMG}/socialization.webp`,
    Icon: PawPrint,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
  },
  {
    id: 'advanced_training',
    name: 'Advanced Training',
    image: `${TRAINING_IMG}/advance-training.webp`,
    Icon: Trophy,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100',
    aliases: ['advanced_skills'],
  },
  {
    id: 'aggression',
    name: 'Aggression Fix',
    image: `${TRAINING_IMG}/agression-fix.webp`,
    Icon: AlertTriangle,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-100',
    aliases: ['aggression_fix', 'agression_fix'],
  },
  {
    id: 'separation_anxiety',
    name: 'Separation Anxiety',
    image: `${TRAINING_IMG}/separation-anxiety.webp`,
    Icon: Frown,
    iconColor: 'text-yellow-600',
    iconBg: 'bg-yellow-100',
  },
  {
    id: 'excessive_barking',
    name: 'Excessive Barking',
    image: `${TRAINING_IMG}/excessive-barking.webp`,
    Icon: Volume2,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-100',
    aliases: ['barking'],
  },
  {
    id: 'fear_phobia',
    name: 'Fear & Phobias',
    image: `${TRAINING_IMG}/fear-n-phobia.webp`,
    Icon: Ghost,
    iconColor: 'text-indigo-600',
    iconBg: 'bg-indigo-100',
    aliases: ['fear_n_phobia'],
  },
  {
    id: 'destructive',
    name: 'Destructive Behavior',
    image: `${TRAINING_IMG}/destructive-behaviour.webp`,
    Icon: Bomb,
    iconColor: 'text-rose-600',
    iconBg: 'bg-rose-100',
    aliases: ['destructive_behavior', 'destructive_behaviour'],
  },
  {
    id: 'resource_guarding',
    name: 'Possessive Behavior',
    image: `${TRAINING_IMG}/possessive-behaviour.webp`,
    Icon: Shield,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    aliases: ['possessive_behavior', 'possessive_behaviour'],
  },
];

const GOAL_IMAGE_BY_KEY = new Map<string, string>();
const GOAL_NAME_BY_KEY = new Map<string, string>();
const GOAL_ICON_BY_KEY = new Map<string, TrainingGoalCardDef>();

for (const card of TRAINING_GOAL_CARDS) {
  const keys = [card.id, ...(card.aliases ?? [])].map((k) => k.toLowerCase());
  for (const k of keys) {
    GOAL_IMAGE_BY_KEY.set(k, card.image);
    GOAL_NAME_BY_KEY.set(k, card.name);
    GOAL_ICON_BY_KEY.set(k, card);
  }
}

export function trainingGoalImageForId(problemId: string): string | undefined {
  return GOAL_IMAGE_BY_KEY.get(problemId.toLowerCase());
}

export function trainingGoalCardForId(problemId: string): TrainingGoalCardDef | undefined {
  return GOAL_ICON_BY_KEY.get(problemId.toLowerCase());
}

export function isTrainingViewAllProblem(problem: { id?: string }): boolean {
  return String(problem.id ?? '').toLowerCase() === 'view_all';
}

export function resolveTrainingGoalDisplay(
  problem: { id: string; name: string },
  index: number,
): { image: string; label: string; iconDef?: TrainingGoalCardDef } {
  const key = problem.id.toLowerCase();
  const iconDef = trainingGoalCardForId(key);
  const image =
    trainingGoalImageForId(key) ??
    TRAINING_GOAL_CARDS[index % TRAINING_GOAL_CARDS.length].image;
  const label = GOAL_NAME_BY_KEY.get(key) ?? problem.name;
  return { image, label, iconDef };
}
