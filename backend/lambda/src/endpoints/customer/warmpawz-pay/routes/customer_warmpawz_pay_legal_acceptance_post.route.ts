import type { Hono } from 'hono';
import { customerWarmpawzPayLegalAcceptancePostHandler } from '../handlers/customer_warmpawz_pay_legal_acceptance_post.handler';

export function registerCustomerWarmpawzPayLegalAcceptancePostRoute(app: Hono): void {
  app.post('/customer/warmpawz-pay/legal-acceptance', customerWarmpawzPayLegalAcceptancePostHandler);
}
