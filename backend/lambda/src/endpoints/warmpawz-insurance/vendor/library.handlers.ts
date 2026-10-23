import type { Context } from 'hono';
import { z } from 'zod';
import {
  DEFAULT_PAWS_N_CLAWS_FORM,
  DEFAULT_PAWS_N_CLAWS_FORM_NAME,
  INSURANCE_SLUGS,
  canTransitionInsuranceStatus,
  chatCardSchema,
  normalizeInsuranceStatus,
  planQuoteCardSchema,
} from '@warmpawz/shared-types';
import { formSchemaIssues, parseFormSchema } from '../shared/form-library';
import { transitionBlockReason } from '../shared/lifecycle';
import { insuranceAdminError, insuranceAdminOk, InsuranceAdminError } from '../admin/shared/insurance-admin-response';
import {
  dbActiveCompanyIdsForVendor,
  dbEnsureDefaultPublishedForm,
  dbGetForm,
  dbInsertForm,
  dbListForms,
  dbListVersions,
  dbPublishForm,
  dbUnpublishForm,
  dbUpdateDraft,
  dbVendorLinkedToCompany,
} from './forms.repo';
import {
  dbGetBookingStatus,
  dbGetVendorApplication,
  dbInsertChatCard,
  dbListVendorApplications,
  dbPinTemplateVersion,
  dbPublishedVersionForVendor,
  dbSetChangeNotes,
} from './cards.repo';

const formBody = z.object({
  companyId: z.string().uuid(),
  planId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(160),
  schema: z.unknown(),
});

function checkedSchema(input: unknown) {
  const schema = parseFormSchema(input);
  const issues = formSchemaIssues(schema);
  if (issues.length) throw new InsuranceAdminError(422, 'INVALID_FORM', issues.join('; '));
  return schema;
}

export async function listFormsHandler(c: Context) {
  try {
    const vendorId = c.req.param('vendorId');
    const schema = checkedSchema(DEFAULT_PAWS_N_CLAWS_FORM);
    const companyIds = await dbActiveCompanyIdsForVendor(vendorId);
    for (const companyId of companyIds) {
      await dbEnsureDefaultPublishedForm({
        vendorId,
        companyId,
        name: DEFAULT_PAWS_N_CLAWS_FORM_NAME,
        schema,
        actor: vendorId,
      });
    }
    return insuranceAdminOk(c, { forms: await dbListForms(vendorId) });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function ensureDefaultFormHandler(c: Context) {
  try {
    const vendorId = c.req.param('vendorId');
    const body = z.object({ companyId: z.string().uuid().optional() }).parse(await c.req.json().catch(() => ({})));
    const schema = checkedSchema(DEFAULT_PAWS_N_CLAWS_FORM);
    const companyIds = body.companyId ? [body.companyId] : await dbActiveCompanyIdsForVendor(vendorId);
    const created: unknown[] = [];
    for (const companyId of companyIds) {
      const linked = await dbVendorLinkedToCompany(vendorId, companyId);
      if (!linked) continue;
      const form = await dbEnsureDefaultPublishedForm({
        vendorId,
        companyId,
        name: DEFAULT_PAWS_N_CLAWS_FORM_NAME,
        schema,
        actor: vendorId,
      });
      if (form) created.push(form);
    }
    return insuranceAdminOk(c, { created, forms: await dbListForms(vendorId) });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function createFormHandler(c: Context) {
  try {
    const vendorId = c.req.param('vendorId');
    const body = formBody.parse(await c.req.json());
    const linked = await dbVendorLinkedToCompany(vendorId, body.companyId);
    if (!linked) throw new InsuranceAdminError(422, 'VENDOR_NOT_LINKED', 'Vendor is not linked to this company');
    const schema = checkedSchema(body.schema);
    const form = await dbInsertForm({
      vendorId,
      companyId: body.companyId,
      planId: body.planId ?? null,
      name: body.name,
      schema,
    });
    return insuranceAdminOk(c, { form }, 201);
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function updateFormHandler(c: Context) {
  try {
    const body = formBody.omit({ companyId: true }).parse(await c.req.json());
    const schema = checkedSchema(body.schema);
    const form = await dbUpdateDraft(c.req.param('vendorId'), c.req.param('id'), body.name, schema);
    if (!form) throw new InsuranceAdminError(404, 'NOT_FOUND', 'Form not found');
    return insuranceAdminOk(c, { form });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function publishFormHandler(c: Context) {
  try {
    const existing = await dbGetForm(c.req.param('vendorId'), c.req.param('id'));
    if (!existing) throw new InsuranceAdminError(404, 'NOT_FOUND', 'Form not found');
    checkedSchema(existing.draft_schema);
    const version = await dbPublishForm(c.req.param('vendorId'), c.req.param('id'), c.req.param('vendorId'));
    return insuranceAdminOk(c, { version });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function unpublishFormHandler(c: Context) {
  try {
    const form = await dbUnpublishForm(c.req.param('vendorId'), c.req.param('id'));
    if (!form) throw new InsuranceAdminError(404, 'NOT_FOUND', 'Form not found');
    return insuranceAdminOk(c, { form });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function listVersionsHandler(c: Context) {
  try {
    return insuranceAdminOk(c, { versions: await dbListVersions(c.req.param('vendorId'), c.req.param('id')) });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function listSlugsHandler(c: Context) {
  return insuranceAdminOk(c, { slugs: INSURANCE_SLUGS });
}

export async function listApplicationsHandler(c: Context) {
  try {
    return insuranceAdminOk(c, { applications: await dbListVendorApplications(c.req.param('vendorId')) });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

async function transitionCard(
  c: Context,
  toStatus: 'quote_shared' | 'form_sent' | 'changes_requested' | 'form_confirmed' | 'consulted' | 'dropped' | 'cancelled',
  card: unknown,
  message: string,
) {
  const vendorId = c.req.param('vendorId');
  const application = await dbGetVendorApplication(vendorId, c.req.param('id'));
  if (!application) throw new InsuranceAdminError(404, 'NOT_FOUND', 'Application not found');
  const from = normalizeInsuranceStatus(application.status);
  if (!application.booking_id) throw new InsuranceAdminError(422, 'NO_BOOKING', 'Application has no consultation booking');

  const consultGuards =
    toStatus === 'consulted'
      ? [
          {
            ok: (await dbGetBookingStatus(String(application.booking_id)))?.toLowerCase() === 'completed',
            reason: 'Mark the tele consultation complete in Bookings before marking consulted',
          },
        ]
      : [];
  const blocked = transitionBlockReason(String(application.status), toStatus, consultGuards);
  if (blocked || !from || !canTransitionInsuranceStatus(from, toStatus)) {
    throw new InsuranceAdminError(422, 'INVALID_TRANSITION', blocked || `Cannot move from ${application.status} to ${toStatus}`);
  }

  const parsed = chatCardSchema.parse(card);
  if (parsed.applicationId !== String(application.id)) {
    throw new InsuranceAdminError(422, 'WRONG_APPLICATION', 'Card application does not match');
  }
  const saved = await dbInsertChatCard({
    bookingId: String(application.booking_id),
    senderPhone: vendorId,
    message,
    card: parsed,
    fromStatus: from,
    toStatus,
    actorId: vendorId,
  });
  return insuranceAdminOk(c, { messageId: saved.messageId, status: toStatus });
}

export async function quoteHandler(c: Context) {
  try {
    const body = planQuoteCardSchema.parse(await c.req.json());
    return await transitionCard(c, 'quote_shared', body, 'Plan quote');
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function formRequestHandler(c: Context) {
  try {
    const body = z.object({ templateId: z.string().uuid() }).parse(await c.req.json());
    const version = await dbPublishedVersionForVendor(c.req.param('vendorId'), body.templateId);
    if (!version) throw new InsuranceAdminError(422, 'FORM_NOT_PUBLISHED', 'Publish the form before sending it');
    const applicationId = c.req.param('id');
    await dbPinTemplateVersion(applicationId, String(version.id));
    return await transitionCard(
      c,
      'form_sent',
      {
        card: 'form_request',
        applicationId,
        version: Number(version.version),
        templateId: body.templateId,
        templateVersionId: String(version.id),
      },
      'Information form',
    );
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function changeRequestHandler(c: Context) {
  try {
    const body = z.object({ notes: z.record(z.string(), z.string().min(1)) }).parse(await c.req.json());
    const applicationId = c.req.param('id');
    await dbSetChangeNotes(applicationId, body.notes);
    return await transitionCard(
      c,
      'changes_requested',
      { card: 'change_request', applicationId, version: 1, notes: body.notes },
      'Corrections requested',
    );
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function confirmFormHandler(c: Context) {
  try {
    const body = z.object({ to: z.string().optional() }).parse(await c.req.json().catch(() => ({})));
    const applicationId = c.req.param('id');
    const application = await dbGetVendorApplication(c.req.param('vendorId'), applicationId);
    if (!application) throw new InsuranceAdminError(404, 'NOT_FOUND', 'Application not found');
    const from = normalizeInsuranceStatus(application.status);
    const to = body.to || 'form_confirmed';
    if (to !== 'form_confirmed' && to !== 'consulted' && to !== 'dropped' && to !== 'cancelled') {
      throw new InsuranceAdminError(422, 'INVALID_TRANSITION', 'This transition is not available here');
    }
    return await transitionCard(
      c,
      to as 'consulted' | 'form_confirmed' | 'dropped' | 'cancelled',
      {
        card: 'status_update',
        applicationId,
        version: 1,
        fromStatus: from,
        toStatus: to,
      },
      to === 'consulted'
        ? 'Consultation complete'
        : to === 'dropped' || to === 'cancelled'
          ? 'Application archived'
          : 'Details confirmed',
    );
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}
