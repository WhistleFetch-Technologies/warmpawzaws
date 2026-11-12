import type { Hono } from 'hono';
import { customerWarmpawzPayLegalAcceptanceGetHandler } from '../handlers/customer_warmpawz_pay_legal_acceptance_get.handler';

export function registerCustomerWarmpawzPayLegalAcceptanceGetRoute(app: Hono): void {
  app.get('/customer/warmpawz-pay/legal-acceptance', customerWarmpawzPayLegalAcceptanceGetHandler);
}
