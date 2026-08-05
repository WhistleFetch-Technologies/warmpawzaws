export type ProblemDiscoveryKind =
  | 'vet_at_center'
  | 'vet_other'
  | 'groomer'
  | 'trainer'
  | 'behavior'
  | 'nutrition'
  | 'walker'
  | 'boarding';

const PROBLEM_KIND_TO_WAPPT_CATEGORY: Record<ProblemDiscoveryKind, string> = {
  vet_at_center: 'vet',
  vet_other: 'vet',
  groomer: 'grooming',
  trainer: 'training',
  behavior: 'behaviorist',
  nutrition: 'nutrition',
  walker: 'walker',
  boarding: 'boarding',
};

export function resolveProblemGridWapptCategory(kind: ProblemDiscoveryKind): string {
  return PROBLEM_KIND_TO_WAPPT_CATEGORY[kind];
}
