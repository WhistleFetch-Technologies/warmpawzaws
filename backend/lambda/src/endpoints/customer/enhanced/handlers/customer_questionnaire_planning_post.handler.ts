import type { Context } from 'hono';
import { executecustomerQuestionnairePlanningPost } from '../services/customer_questionnaire_planning_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerQuestionnairePlanningPostHandler(c: Context) {
  return executecustomerQuestionnairePlanningPost(c);
}
