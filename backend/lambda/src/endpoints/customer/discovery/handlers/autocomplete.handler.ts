import type { Context } from 'hono';
import { executeautocomplete } from '../services/autocomplete.service';

/** HTTP adapter — delegates to service layer. */
export async function autocompleteHandler(c: Context) {
  return executeautocomplete(c);
}
