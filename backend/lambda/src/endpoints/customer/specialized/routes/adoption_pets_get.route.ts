import type { Hono } from 'hono';
import { adoptionPetsGetHandler } from '../handlers/adoption_pets_get.handler';

export function registerAdoptionPetsGetRoute(app: Hono) {
  app.get("/adoption/pets", adoptionPetsGetHandler);
}
