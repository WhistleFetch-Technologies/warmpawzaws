import type { Context } from 'hono';
import { dbFetchWapptPolicyTiersForCategory } from '../repos/wappt_booking_policy.repo';

export async function executeWapptPoliciesGet(c: Context) {
  const category = c.req.query('category') ?? undefined;
  const data = await dbFetchWapptPolicyTiersForCategory(category);
  return c.json({ success: true, ...data });
}
