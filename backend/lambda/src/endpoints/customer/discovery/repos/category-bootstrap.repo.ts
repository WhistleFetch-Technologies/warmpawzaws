import { query } from '../../../../database/rds-connection';

/** Align with customer-web `PROBLEM_GRID_ALIASES_BY_ROLE` + specialization-master role overlap. */
const ROLE_ALIASES: Record<string, string[]> = {
  vet: ['veterinarian', 'vet_solo', 'vet_clinic', 'vet_center', 'pet_clinic'],
  veterinarian: ['veterinarian', 'vet_solo', 'vet_clinic', 'vet_center', 'pet_clinic'],
  groomer: ['groomer', 'groomer_solo', 'groomer_center', 'pet_groomer'],
  grooming: ['groomer', 'groomer_solo', 'groomer_center', 'pet_groomer'],
  trainer: ['trainer', 'trainer_solo', 'trainer_center', 'pet_trainer'],
  training: ['trainer', 'trainer_solo', 'trainer_center', 'pet_trainer'],
  walker: ['walker', 'pet_walker', 'walker_solo'],
  boarding: ['boarding', 'pet_boarder', 'pet_boarding', 'boarding_solo', 'boarding_center'],
  behaviorist: ['behaviourist', 'behaviorist', 'pet_behaviorist', 'behaviourist_solo'],
  behaviourist: ['behaviourist', 'behaviorist', 'pet_behaviorist', 'behaviourist_solo'],
  nutritionist: ['nutritionist', 'nutritionist_solo', 'nutritionist_center', 'pet_nutritionist'],
  nutrition: ['nutritionist', 'nutritionist_solo', 'nutritionist_center', 'pet_nutritionist'],
};

function expandRoles(roleId?: string | null, category?: string | null): string[] {
  const key = String(roleId || category || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!key) return [];
  const aliases = ROLE_ALIASES[key];
  if (aliases?.length) return [...new Set(aliases.map((r) => r.toLowerCase()))];
  return [key];
}

/**
 * Category landing problems — same canonical ids as GET /public/problem-grid/:roleId
 * (`specialization_master.specialization_id`), not legacy problem_grid_mappings slugs.
 */
export async function dbCategoryBootstrapProblems(roleId?: string | null, category?: string | null) {
  const expandedRoles = expandRoles(roleId, category);
  if (expandedRoles.length === 0) {
    return { rows: [] };
  }

  const resolvedRoleId = String(roleId || category || expandedRoles[0]).trim();

  return query(
    `
    SELECT sm.specialization_id AS id,
           COALESCE(sm.display_name, sm.name) AS title,
           $2::text AS "roleId"
    FROM specialization_master sm
    WHERE sm.is_active = true
      AND (sm.show_in_problem_grid = true OR sm.show_in_services_dashboard = true)
      AND (
        sm.applicable_roles = '{}'
        OR sm.applicable_roles IS NULL
        OR array_length(sm.applicable_roles, 1) IS NULL
        OR sm.applicable_roles && $1::text[]
      )
    ORDER BY sm.display_order NULLS LAST, sm.name
    LIMIT 40
  `,
    [expandedRoles, resolvedRoleId],
  );
}
