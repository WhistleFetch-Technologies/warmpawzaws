import type { Hono } from 'hono';
import { breederPuppiesGetHandler } from '../handlers/breeder_puppies_get.handler';

export function registerBreederPuppiesGetRoute(app: Hono) {
  app.get("/breeder/puppies", breederPuppiesGetHandler);
}
