import type { Hono } from 'hono';
import { breederReservePostHandler } from '../handlers/breeder_reserve_post.handler';

export function registerBreederReservePostRoute(app: Hono) {
  app.post("/breeder/reserve", breederReservePostHandler);
}
