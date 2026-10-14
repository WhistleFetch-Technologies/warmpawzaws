import type { Context } from 'hono';
import { z } from 'zod';
import {
  commissionTermsInputSchema,
  linkScheduleInputSchema,
  vendorLinkConfigSchema,
  vendorLinkCreateSchema,
  vendorLinkUpdateSchema,
} from '../dto/insurance-admin.requests';
import { insuranceAdminActorId } from '../middleware/require-insurance-admin-permission.middleware';
import {
  addVendorLinkTerms,
  createVendorLink,
  listInsuranceVendorCandidates,
  listVendorLinks,
  listVendorLinkTerms,
  saveVendorLinkConfig,
  setVendorLinkPayoutSchedule,
  updateVendorLink,
} from '../services/insurance-vendor-links.service';
import { jsonBody, respond } from './respond';

const idParam = z.string().uuid();
const linkFilterSchema = z.object({
  companyId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
});
const candidateQuerySchema = z.object({ search: z.string().trim().max(80).optional() });

export const listVendorLinksHandler = (c: Context) =>
  respond(c, () => listVendorLinks(linkFilterSchema.parse(c.req.query())));

export const listVendorCandidatesHandler = (c: Context) =>
  respond(c, () => listInsuranceVendorCandidates(candidateQuerySchema.parse(c.req.query()).search || undefined));

export const createVendorLinkHandler = (c: Context) =>
  respond(
    c,
    async () => createVendorLink(vendorLinkCreateSchema.parse(await jsonBody(c)), insuranceAdminActorId(c)),
    201,
  );

export const updateVendorLinkHandler = (c: Context) =>
  respond(c, async () =>
    updateVendorLink(
      idParam.parse(c.req.param('id')),
      vendorLinkUpdateSchema.parse(await jsonBody(c)),
      insuranceAdminActorId(c),
    ),
  );

export const listVendorLinkTermsHandler = (c: Context) =>
  respond(c, () => listVendorLinkTerms(idParam.parse(c.req.param('id'))));

export const addVendorLinkTermsHandler = (c: Context) =>
  respond(
    c,
    async () =>
      addVendorLinkTerms(
        idParam.parse(c.req.param('id')),
        commissionTermsInputSchema.parse(await jsonBody(c)),
        insuranceAdminActorId(c),
      ),
    201,
  );

export const saveVendorLinkConfigHandler = (c: Context) =>
  respond(c, async () =>
    saveVendorLinkConfig(
      idParam.parse(c.req.param('id')),
      vendorLinkConfigSchema.parse(await jsonBody(c)),
      insuranceAdminActorId(c),
    ),
  );

export const setVendorLinkScheduleHandler = (c: Context) =>
  respond(c, async () =>
    setVendorLinkPayoutSchedule(
      idParam.parse(c.req.param('id')),
      linkScheduleInputSchema.parse(await jsonBody(c)),
      insuranceAdminActorId(c),
    ),
  );
