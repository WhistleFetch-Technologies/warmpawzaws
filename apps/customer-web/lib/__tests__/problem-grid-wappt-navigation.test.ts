import {
  resolveProblemGridWapptCategory,
  type ProblemDiscoveryKind,
} from '../problem-grid-wappt-navigation';

describe('resolveProblemGridWapptCategory', () => {
  it.each([
    ['vet_at_center', 'vet'],
    ['vet_other', 'vet'],
    ['groomer', 'grooming'],
    ['trainer', 'training'],
    ['behavior', 'behaviorist'],
    ['nutrition', 'nutrition'],
    ['walker', 'walker'],
    ['boarding', 'boarding'],
  ] as const)('maps %s to %s', (kind, category) => {
    expect(resolveProblemGridWapptCategory(kind as ProblemDiscoveryKind)).toBe(category);
  });
});
