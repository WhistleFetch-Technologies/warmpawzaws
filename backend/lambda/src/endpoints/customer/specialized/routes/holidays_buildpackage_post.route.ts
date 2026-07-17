import type { Hono } from 'hono';
import { holidaysBuildpackagePostHandler } from '../handlers/holidays_buildpackage_post.handler';

export function registerHolidaysBuildpackagePostRoute(app: Hono) {
  app.post("/holidays/build-package", holidaysBuildpackagePostHandler);
}
