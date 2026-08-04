import type { Context } from 'hono';
import { executeWapptPoliciesGet } from '../services/wappt_policies_get.service';

export async function wapptPoliciesGetHandler(c: Context) {
  return executeWapptPoliciesGet(c);
}
