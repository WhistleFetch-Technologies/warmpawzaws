import type { Context } from 'hono';
import { z } from 'zod';
import {
  canTransitionInsuranceStatus,
  formSchemaSchema,
  normalizeInsuranceStatus,
  validateDynamicForm,
} from '@warmpawz/shared-types';
import { isWarmpawzInsuranceEnabled } from '../../../../lib/warmpawz-insurance-flags';
import { nextSubmissionRevision } from '../../../warmpawz-insurance/shared/form-library';
import { resolveSlugValues } from '../../../warmpawz-insurance/shared/slug-resolver';
import {
  dbGetApplication,
  dbInsertSubmission,
  dbLatestSubmission,
  dbSlugProfile,
  dbTemplateVersion,
} from '../repos/customer-insurance.repo';

const bodySchema = z.object({
  customerId: z.string().uuid(),
  consent: z.literal(true),
  answers: z.record(z.string(), z.unknown()),
});

export async function executecustomerInsuranceApplicationsIdFormPost(c: Context) {
  if (!isWarmpawzInsuranceEnabled()) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Warmpawz Insurance is disabled' } }, 404);
  }
  const input = bodySchema.parse(await c.req.json());
  const application = await dbGetApplication(c.req.param('id'));
  if (!application || String(application.customer_id) !== input.customerId) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } }, 404);
  }
  const from = normalizeInsuranceStatus(application.status);
  if (!from || !canTransitionInsuranceStatus(from, 'form_submitted')) {
    return c.json({ success: false, error: { code: 'INVALID_TRANSITION', message: 'This form cannot be submitted now' } }, 422);
  }
  const versionId = application.template_version_id ? String(application.template_version_id) : '';
  const version = versionId ? await dbTemplateVersion(versionId) : null;
  if (!version) return c.json({ success: false, error: { code: 'FORM_NOT_SENT', message: 'The vendor has not sent a form yet' } }, 404);
  const schema = formSchemaSchema.parse(version.schema);
  const errors = validateDynamicForm(schema, input.answers);
  if (Object.keys(errors).length) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Form is incomplete', details: errors } }, 400);
  }
  const profile = await dbSlugProfile(input.customerId, application.pet_id ? String(application.pet_id) : null);
  const prefilled = resolveSlugValues(profile)
    .filter((row) => row.value)
    .map((row) => row.slug);
  const latest = await dbLatestSubmission(String(application.id));
  const revision = nextSubmissionRevision(latest ? Number(latest.revision) : null).revision;
  const submission = await dbInsertSubmission({
    applicationId: String(application.id),
    templateVersionId: String(version.id),
    revision,
    answers: input.answers,
    prefilledSlugs: prefilled,
    consentAt: new Date().toISOString(),
  });
  return c.json({ success: true, data: { submission } }, 201);
}
