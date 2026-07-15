import type { Hono } from 'hono';
import { adoptionPetsPetidGetHandler } from '../handlers/adoption_pets_petid_get.handler';

export function registerAdoptionPetsPetidGetRoute(app: Hono) {
  app.get("/adoption/pets/:petId", adoptionPetsPetidGetHandler);
}
