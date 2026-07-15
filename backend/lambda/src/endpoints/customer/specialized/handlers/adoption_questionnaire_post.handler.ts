import type { Context } from 'hono';
import { executeadoptionQuestionnairePost } from '../services/adoption_questionnaire_post.service';

/** HTTP adapter — delegates to service layer. */
export async function adoptionQuestionnairePostHandler(c: Context) {
  return executeadoptionQuestionnairePost(c);
}
