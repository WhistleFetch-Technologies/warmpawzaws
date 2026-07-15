import type { Hono } from 'hono';
import { adoptionRequestPostHandler } from '../handlers/adoption_request_post.handler';

export function registerAdoptionRequestPostRoute(app: Hono) {
  app.post("/adoption/request", adoptionRequestPostHandler);
}
