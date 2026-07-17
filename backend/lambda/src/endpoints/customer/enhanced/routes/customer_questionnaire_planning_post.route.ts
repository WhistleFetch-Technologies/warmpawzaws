import type { Hono } from 'hono';
import { customerQuestionnairePlanningPostHandler } from '../handlers/customer_questionnaire_planning_post.handler';

export function registerCustomerQuestionnairePlanningPostRoute(app: Hono) {
  app.post('/customer/questionnaire/planning', customerQuestionnairePlanningPostHandler);
}
