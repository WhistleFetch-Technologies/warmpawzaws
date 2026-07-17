import type { Hono } from 'hono';
import { autocompleteHandler } from '../handlers/autocomplete.handler';

export function registerAutocompleteRoute(app: Hono) {
  app.get("/customer/autocomplete", autocompleteHandler);
}
