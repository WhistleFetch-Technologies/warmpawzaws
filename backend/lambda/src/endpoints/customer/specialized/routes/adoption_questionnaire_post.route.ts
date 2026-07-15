import type { Hono } from 'hono';
import { adoptionQuestionnairePostHandler } from '../handlers/adoption_questionnaire_post.handler';

export function registerAdoptionQuestionnairePostRoute(app: Hono) {
  app.post("/adoption/questionnaire", adoptionQuestionnairePostHandler);
}
