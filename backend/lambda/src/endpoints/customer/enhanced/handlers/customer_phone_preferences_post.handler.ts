import type { Context } from 'hono';
import { executecustomerPhonePreferencesPost } from '../services/customer_phone_preferences_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhonePreferencesPostHandler(c: Context) {
  return executecustomerPhonePreferencesPost(c);
}
