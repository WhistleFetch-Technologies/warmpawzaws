import { query } from '../../../../database/rds-connection';

export async function dbCategoryBootstrapProblems(roleId?: string | null, category?: string | null) {
  const params: string[] = [];
  let where = '1=1';
  if (roleId) {
    params.push(roleId);
    where += ` AND role_id = $${params.length}`;
  } else if (category) {
    params.push(category);
    where += ` AND (role_id = $${params.length} OR sub_category_id ILIKE '%' || $${params.length} || '%')`;
  }
  return query(
    `
    SELECT DISTINCT problem_id AS id,
           COALESCE(problem_display_name, problem_name) AS title,
           role_id AS "roleId"
    FROM problem_grid_mappings
    WHERE ${where}
    ORDER BY title
    LIMIT 40
  `,
    params
  );
}
