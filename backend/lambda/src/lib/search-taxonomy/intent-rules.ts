import { hasPetToken } from './service-scope';
import type { SearchIntentModifiers } from './types';

export type IntentRuleResult = {
  hubSlug: string;
  intentCode: string;
  score: number;
  matchedSignals: string[];
  modifiers: SearchIntentModifiers;
};

const GENERIC_STOP_TOKENS = new Set([
  'best',
  'good',
  'great',
  'nice',
  'beautiful',
  'find',
  'need',
  'want',
  'looking',
  'search',
  'please',
  'help',
  'someone',
  'experienced',
  'professional',
  'qualified',
  'top',
  'near',
  'me',
  'my',
  'for',
  'the',
  'a',
  'an',
  'and',
  'or',
  'with',
  'while',
  'where',
  'can',
  'get',
  'i',
  'am',
  'is',
  'are',
  'to',
  'in',
  'on',
  'at',
  'of',
  'service',
  'services',
  'center',
  'centre',
  'place',
  'safe',
  'issues',
  'problem',
  'problems',
  'fix',
]);

const PET_TOKENS = new Set(['dog', 'cat', 'pet', 'puppy', 'kitten', 'animal']);

type RuleCandidate = {
  hubSlug: string;
  intentCode: string;
  score: number;
  signal: string;
};

/** Extract location/convenience modifiers (never hubs). */
export function extractSearchModifiers(normalized: string): SearchIntentModifiers {
  const q = (normalized || '').trim();
  const modifiers: SearchIntentModifiers = {};

  if (/\bnear me\b/.test(q) || /\bnearby\b/.test(q)) {
    modifiers.nearMe = true;
  }
  if (/\bopen now\b/.test(q) || /\b24 hour\b/.test(q) || /\b24 hours\b/.test(q)) {
    modifiers.openNow = true;
  }
  if (
    /\bat home\b/.test(q) ||
    /\bhome visit\b/.test(q) ||
    /\bdoorstep\b/.test(q) ||
    /\bcome to my house\b/.test(q) ||
    /\bhome grooming\b/.test(q) ||
    /\bhome vet\b/.test(q)
  ) {
    modifiers.atHome = true;
  }
  if (/\bsame day\b/.test(q) || /\btoday\b/.test(q)) {
    modifiers.sameDay = true;
  }

  return modifiers;
}

/**
 * Token/intent scoring when dictionary phrase/substring match fails.
 * Returns null when confidence is insufficient.
 */
export function resolveIntentFromRules(
  normalized: string,
  tokens: string[]
): IntentRuleResult | null {
  const tokenSet = new Set(tokens);
  const hasPet = hasPetToken(tokenSet);
  const candidates: RuleCandidate[] = [];

  const add = (hubSlug: string, intentCode: string, score: number, signal: string) => {
    if (score <= 0) return;
    candidates.push({ hubSlug, intentCode, score, signal });
  };

  const has = (...words: string[]) => words.every((w) => tokenSet.has(w) || normalized.includes(w));
  const hasAny = (...words: string[]) =>
    words.some((w) => tokenSet.has(w) || normalized.includes(w));

  // ── Veterinary ──
  if (has('doctor') && hasPet) {
    add('vet', 'GENERAL_VET_CARE', 420, 'doctor+pet');
  }
  if (
    (hasAny('vet', 'veterinarian', 'doctor', 'clinic') || normalized.includes('pet')) &&
    hasAny('vaccination', 'vaccinate', 'deworming') &&
    (hasPet || normalized.includes('pet'))
  ) {
    add('vet', 'PREVENTIVE_OR_GENERAL_VET', 430, 'vet+preventive');
  }
  if (hasAny('veterinarian', 'veterinary') || tokenSet.has('vet')) {
    add('vet', 'GENERAL_VET_CARE', 400, 'vet');
  }
  if (hasAny('clinic', 'hospital') && (hasPet || normalized.includes('pet'))) {
    add('vet', 'GENERAL_VET_CARE', 380, 'clinic/hospital');
  }
  if (hasAny('sick', 'vaccination', 'deworming', 'vaccinate')) {
    add('vet', 'PREVENTIVE_OR_GENERAL_VET', 360, 'medical/preventive');
  }
  if (hasAny('emergency', 'urgent') && (hasPet || normalized.includes('medical'))) {
    add('vet', 'EMERGENCY_VET', 400, 'emergency');
  }
  if (hasAny('x-ray', 'xray', 'blood', 'scan', 'ambulance', 'dentist', 'physiotherapy')) {
    add('vet', 'VET_SPECIALIZED', 350, 'diagnostics/specialized');
  }
  if (normalized.includes('check my dog') || normalized.includes('check my cat') || normalized.includes('pet is sick')) {
    add('vet', 'GENERAL_VET_CARE', 370, 'sick/check');
  }

  // ── Grooming ──
  if (hasAny('groom', 'grooming', 'groomer', 'salon', 'spa')) {
    add('grooming', 'GROOMING_GENERAL', 400, 'grooming');
  }
  if (has('hair', 'cut') || normalized.includes('hair cut') || tokenSet.has('haircut')) {
    add('grooming', 'GROOMING_HAIR_CUT', 390, 'hair cut');
  }
  if (hasAny('bath', 'blow', 'dry', 'deshedding', 'nail', 'trim', 'fur')) {
    add('grooming', 'GROOMING_HYGIENE', 360, 'grooming-hygiene');
  }
  if (normalized.includes('tick treatment') || normalized.includes('flea treatment')) {
    add('grooming', 'GROOMING_TICK_FLEA', 380, 'tick/flea treatment');
  }
  if (normalized.includes('get my dog groomed') || normalized.includes('cut my dog')) {
    add('grooming', 'GROOMING_GENERAL', 370, 'groomed/cut');
  }

  // ── Boarding ──
  if (hasAny('boarding', 'kennel', 'hostel', 'daycare', 'staycation')) {
    add('boarding', 'BOARDING', 400, 'boarding');
  }
  if (normalized.includes('keep my dog') || normalized.includes('keep my cat')) {
    add('boarding', 'DOG_BOARDING', 390, 'keep pet');
  }
  if (normalized.includes('while i travel') || normalized.includes('while i am away')) {
    add('boarding', 'BOARDING', 380, 'travel');
  }
  if (normalized.includes('overnight stay') || normalized.includes('overnight pet')) {
    add('boarding', 'OVERNIGHT_BOARDING', 370, 'overnight');
  }
  if (normalized.includes('safe place') && hasPet) {
    add('boarding', 'BOARDING', 360, 'safe place');
  }

  // ── Training ──
  if (hasAny('trainer', 'training', 'obedience', 'behaviourist', 'behaviorist')) {
    add('training', 'TRAINING', 400, 'training');
  }
  if (
    hasAny('trainer', 'training', 'obedi') &&
    hasAny('aggressive', 'aggression', 'barking', 'biting', 'anxiety')
  ) {
    add('training', 'BEHAVIOUR_CORRECTION', 620, 'trainer+behaviour');
  }
  if (hasAny('aggressive', 'aggression', 'barking', 'biting', 'anxiety')) {
    add('training', 'BEHAVIOUR_CORRECTION', 390, 'behaviour');
  }
  if (hasAny('leash', 'potty', 'socialization', 'socialisation')) {
    add('training', 'HABIT_TRAINING', 370, 'habit training');
  }
  if (normalized.includes('stop barking') || normalized.includes('aggression issue')) {
    add('training', 'BEHAVIOUR_CORRECTION', 380, 'behaviour phrase');
  }

  // ── Walker ──
  if (hasAny('walker', 'walking') || normalized.includes('dog walk') || normalized.includes('walk my dog')) {
    add('walker', 'DOG_WALKING', 400, 'walker');
  }
  if (
    hasPet &&
    tokenSet.has('walk') &&
    !tokenSet.has('walker') &&
    !tokenSet.has('walking')
  ) {
    add('walker', 'DOG_WALKING', 385, 'walk+pet');
  }
  if (normalized.includes('daily walk') || normalized.includes('puppy walk')) {
    add('walker', 'DOG_WALKING', 380, 'daily walk');
  }

  // ── Sitting ──
  if (
    hasAny('sitter', 'sitting', 'nanny') ||
    normalized.includes('look after my') ||
    normalized.includes('pet sitter') ||
    normalized.includes('cat sitter')
  ) {
    add('pet-sitter', 'PET_SITTING', 400, 'sitting');
  }
  if (normalized.includes('overnight sitter') || normalized.includes('overnight care')) {
    add('pet-sitter', 'OVERNIGHT_SITTING', 390, 'overnight sitter');
  }

  // ── Nutrition ──
  if (
    normalized.includes('diet consultation') ||
    normalized.includes('nutrition consultation')
  ) {
    add('nutritionist', 'NUTRITION_CONSULT', 415, 'diet consultation');
  }
  if (tokenSet.has('nutritionist') || normalized.includes('pet nutritionist')) {
    add('nutritionist', 'NUTRITION_CONSULT', 420, 'nutritionist');
  }
  if (tokenSet.has('overweight') || normalized.includes('weight management')) {
    add('nutritionist', 'WEIGHT_MANAGEMENT', 410, 'weight');
  }
  if (
    (tokenSet.has('diet') && hasPet && !tokenSet.has('food')) ||
    normalized.includes('diet plan') ||
    (tokenSet.has('diet') && tokenSet.has('plan'))
  ) {
    add('nutritionist', 'DIET_PLAN', 400, 'diet plan');
  }
  if (normalized.includes('allergy diet') || normalized.includes('senior dog nutrition')) {
    add('nutritionist', 'SPECIALIZED_NUTRITION', 390, 'specialized nutrition');
  }
  if (tokenSet.has('nutrition') && hasPet && !tokenSet.has('food')) {
    add('nutritionist', 'NUTRITION_CONSULT', 360, 'nutrition');
  }

  if (candidates.length === 0) return null;

  const byHub = new Map<string, RuleCandidate>();
  for (const c of candidates) {
    const existing = byHub.get(c.hubSlug);
    if (!existing || c.score > existing.score) {
      byHub.set(c.hubSlug, c);
    }
  }

  const ranked = Array.from(byHub.values()).sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top || top.score < 340) return null;

  const modifiers = extractSearchModifiers(normalized);
  const matchedSignals = candidates
    .filter((c) => c.hubSlug === top.hubSlug)
    .map((c) => c.signal);

  return {
    hubSlug: top.hubSlug,
    intentCode: top.intentCode,
    score: top.score,
    matchedSignals,
    modifiers,
  };
}

/** True if phrase is only generic/stop words (must not drive hub alone). */
export function isGenericOnlyPhrase(phraseNorm: string): boolean {
  const tokens = phraseNorm.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => GENERIC_STOP_TOKENS.has(t) || PET_TOKENS.has(t));
}

/** All tokens of phrase present in query token set (order-independent). */
export function phraseTokensMatchQuery(phraseNorm: string, queryTokenSet: Set<string>): boolean {
  const phraseTokens = phraseNorm.split(/\s+/).filter(Boolean);
  if (phraseTokens.length === 0) return false;
  if (phraseTokens.length === 1 && (GENERIC_STOP_TOKENS.has(phraseTokens[0]) || isGenericOnlyPhrase(phraseNorm))) {
    return false;
  }
  return phraseTokens.every((t) => queryTokenSet.has(t));
}
