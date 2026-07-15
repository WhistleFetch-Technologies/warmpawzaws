import type { Context } from 'hono';
import { executediscoverByProblem } from '../services/discover-by-problem.service';

/** HTTP adapter — delegates to service layer. */
export async function discoverByProblemHandler(c: Context) {
  return executediscoverByProblem(c);
}
