import type { Context } from 'hono';
import { z } from 'zod';
import { planInputSchema } from '../dto/insurance-admin.requests';
import { insuranceAdminActorId } from '../middleware/require-insurance-admin-permission.middleware';
import {
  createCompanyPlan,
  getPlanReadiness,
  listCompanyPlans,
  publishPlan,
  unpublishPlan,
  updateCompanyPlan,
} from '../services/insurance-plans.service';
import { jsonBody, respond } from './respond';

const uuid = z.string().uuid();

export const listPlansHandler = (c: Context) =>
  respond(c, () => listCompanyPlans(uuid.parse(c.req.param('id'))));

export const createPlanHandler = (c: Context) =>
  respond(
    c,
    async () =>
      createCompanyPlan(uuid.parse(c.req.param('id')), planInputSchema.parse(await jsonBody(c)), insuranceAdminActorId(c)),
    201,
  );

export const updatePlanHandler = (c: Context) =>
  respond(c, async () =>
    updateCompanyPlan(
      uuid.parse(c.req.param('id')),
      uuid.parse(c.req.param('planId')),
      planInputSchema.parse(await jsonBody(c)),
      insuranceAdminActorId(c),
    ),
  );

export const publishPlanHandler = (c: Context) =>
  respond(c, () => publishPlan(uuid.parse(c.req.param('id')), insuranceAdminActorId(c)));

export const unpublishPlanHandler = (c: Context) =>
  respond(c, () => unpublishPlan(uuid.parse(c.req.param('id')), insuranceAdminActorId(c)));

export const readinessHandler = (c: Context) =>
  respond(c, () => {
    const companyId = uuid.parse(c.req.query('companyId'));
    const planRaw = c.req.query('planId');
    const planId = planRaw ? uuid.parse(planRaw) : undefined;
    return getPlanReadiness(companyId, planId);
  });
