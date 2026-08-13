/**
 * Maps specialization_master category_id (public/problem-grid) to customer role ids
 * (aligned with ProblemGridNavigation).
 */
export const PROBLEM_GRID_CATEGORY_TO_ROLE: Record<string, string> = {
  veterinary: 'veterinarian',
  vet: 'veterinarian',
  grooming: 'groomer',
  training: 'trainer',
  walking: 'walker',
  walker: 'walker',
  boarding: 'boarding',
  behavioral: 'behaviorist',
  behaviour: 'behaviorist',
  wellness: 'nutritionist',
  nutrition: 'nutritionist',
  diagnostic: 'veterinarian',
  diagnostics: 'veterinarian',
};

/** Customer-facing labels that differ from specialization_master / bootstrap API titles. */
export function resolveProblemGridDisplayName(problemId: string, title: string): string {
  const id = problemId.trim().toLowerCase();
  if (id === 'reproductive' || id === 'productive') {
    return 'Reproductive';
  }
  return title;
}
