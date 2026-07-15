import type { Context } from 'hono';
import { executecustomerPhoneOnboardingCompletePost } from '../services/customer_phone_onboarding_complete_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhoneOnboardingCompletePostHandler(c: Context) {
  return executecustomerPhoneOnboardingCompletePost(c);
}
