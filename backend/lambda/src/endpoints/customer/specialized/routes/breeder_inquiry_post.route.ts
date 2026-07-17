import type { Hono } from 'hono';
import { breederInquiryPostHandler } from '../handlers/breeder_inquiry_post.handler';

export function registerBreederInquiryPostRoute(app: Hono) {
  app.post("/breeder/inquiry", breederInquiryPostHandler);
}
