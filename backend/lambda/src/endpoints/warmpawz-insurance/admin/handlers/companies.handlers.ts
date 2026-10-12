import type { Context } from 'hono';
import { z } from 'zod';
import { companyInputSchema } from '../dto/insurance-admin.requests';
import { insuranceAdminActorId } from '../middleware/require-insurance-admin-permission.middleware';
import {
  createInsuranceCompany,
  listInsuranceCompanies,
  updateInsuranceCompany,
} from '../services/insurance-companies.service';
import { jsonBody, respond } from './respond';

const idParam = z.string().uuid();

export const listCompaniesHandler = (c: Context) => respond(c, () => listInsuranceCompanies());

export const createCompanyHandler = (c: Context) =>
  respond(
    c,
    async () => createInsuranceCompany(companyInputSchema.parse(await jsonBody(c)), insuranceAdminActorId(c)),
    201,
  );

export const updateCompanyHandler = (c: Context) =>
  respond(c, async () =>
    updateInsuranceCompany(
      idParam.parse(c.req.param('id')),
      companyInputSchema.parse(await jsonBody(c)),
      insuranceAdminActorId(c),
    ),
  );
