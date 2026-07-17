import type { Hono } from 'hono';
import { customerPhonePetskillsGetHandler } from '../handlers/customer_phone_petskills_get.handler';

export function registerCustomerPhonePetskillsGetRoute(app: Hono) {
  app.get("/customer/:phone/pet-skills", customerPhonePetskillsGetHandler);
}
