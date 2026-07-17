import type { Hono } from 'hono';
import { relocationBookPostHandler } from '../handlers/relocation_book_post.handler';

export function registerRelocationBookPostRoute(app: Hono) {
  app.post("/relocation/book", relocationBookPostHandler);
}
