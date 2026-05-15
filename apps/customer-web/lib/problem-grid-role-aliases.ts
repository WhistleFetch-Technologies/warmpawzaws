/** Role ids / hook keys → API role_id values tried for GET /public/problem-grid/:roleId */

const VET = ['veterinarian', 'vet_solo', 'vet_clinic', 'vet_center', 'pet_clinic'] as const;
const GROOMER = ['groomer', 'groomer_solo', 'groomer_center', 'pet_groomer'] as const;
const TRAINER = ['trainer', 'trainer_solo', 'trainer_center', 'pet_trainer'] as const;
const WALKER = ['walker', 'pet_walker', 'walker_solo'] as const;
const BOARDING = [
  'boarding',
  'pet_boarder',
  'pet_boarding',
  'boarding_solo',
  'boarding_center',
] as const;
const BEHAVIORIST = ['behaviourist', 'behaviorist', 'pet_behaviorist', 'behaviourist_solo'] as const;
const NUTRITIONIST = [
  'nutritionist',
  'nutritionist_solo',
  'nutritionist_center',
  'pet_nutritionist',
] as const;

export const PROBLEM_GRID_ALIASES_BY_ROLE: Record<string, readonly string[]> = {
  vet: VET,
  veterinarian: VET,
  groomer: GROOMER,
  trainer: TRAINER,
  walker: WALKER,
  boarding: BOARDING,
  behaviorist: BEHAVIORIST,
  behaviourist: BEHAVIORIST,
  nutritionist: NUTRITIONIST,
  pet_nutritionist: NUTRITIONIST,
};

export function problemGridAliasesForApi(roleIdOrKey: string): string[] {
  const k = roleIdOrKey.toLowerCase().trim();
  const list = PROBLEM_GRID_ALIASES_BY_ROLE[k];
  return list ? [...list] : [roleIdOrKey];
}
