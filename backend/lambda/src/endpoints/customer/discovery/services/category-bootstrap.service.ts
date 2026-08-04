import type { Context } from 'hono';
import { categoryBootstrapStyles } from '../../../../utils/discovery-category-bootstrap-styles';
import * as categoryBootstrapRepo from '../repos/category-bootstrap.repo';

/** Category landing chrome only — styles, problems; no vendor discovery SQL. */
export async function executeCategoryBootstrap(c: Context) {
  try {
    const category = c.req.query('category');
    const roleId = c.req.query('roleId');
    const styles = categoryBootstrapStyles(category);
    let problems: Array<{ id: string; title: string; roleId?: string }> = [];
    try {
      const res = await categoryBootstrapRepo.dbCategoryBootstrapProblems(roleId, category);
      problems = (res.rows || []).map((r: { id: string; title: string; roleId?: string }) => ({
        id: r.id,
        title: r.title,
        roleId: r.roleId,
      }));
    } catch {
      problems = [];
    }
    return c.json({
      success: true,
      category: category || null,
      roleId: roleId || null,
      styles,
      problems,
      banner: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load category bootstrap';
    return c.json({ success: false, error: message }, 500);
  }
}
