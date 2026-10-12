import type { Context } from 'hono';
import { z } from 'zod';
import { dateRangeQuerySchema, outreachQuerySchema } from '../dto/insurance-admin.requests';
import {
  getInsuranceDashboard,
  listInsuranceApplicationEvents,
  listInsuranceOutreach,
} from '../services/insurance-outreach.service';
import { respond } from './respond';

const idParam = z.string().uuid();

export const dashboardHandler = (c: Context) =>
  respond(c, () => getInsuranceDashboard(dateRangeQuerySchema.parse(c.req.query())));

export const listOutreachHandler = (c: Context) =>
  respond(c, () => listInsuranceOutreach(outreachQuerySchema.parse(c.req.query())));

export const listApplicationEventsHandler = (c: Context) =>
  respond(c, () => listInsuranceApplicationEvents(idParam.parse(c.req.param('id'))));
