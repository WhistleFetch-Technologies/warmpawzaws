import type { Hono } from 'hono';
import { customerPhoneOnboardingCompletePostHandler } from '../handlers/customer_phone_onboarding_complete_post.handler';

export function registerCustomerPhoneOnboardingCompletePostRoute(app: Hono) {
  app.post('/customer/:phone/onboarding/complete', customerPhoneOnboardingCompletePostHandler);
}
