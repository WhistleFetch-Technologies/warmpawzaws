import type { Context } from 'hono';
import { formSchemaSchema, type FormSchema } from '@warmpawz/shared-types';
import { isWarmpawzInsuranceEnabled } from '../../../../lib/warmpawz-insurance-flags';
import { resolveSlugValues } from '../../../warmpawz-insurance/shared/slug-resolver';
import { dbGetApplication, dbLatestSubmission, dbSlugProfile, dbTemplateVersion } from '../repos/customer-insurance.repo';

export async function executecustomerInsuranceApplicationsIdFormGet(c: Context) {
  if (!isWarmpawzInsuranceEnabled()) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Warmpawz Insurance is disabled' } }, 404);
  }
  const customerId = c.req.query('customerId') || '';
  const application = await dbGetApplication(c.req.param('id'));
  if (!application || String(application.customer_id) !== customerId) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } }, 404);
  }
  const versionId = application.template_version_id ? String(application.template_version_id) : '';
  if (!versionId) {
    return c.json({ success: false, error: { code: 'FORM_NOT_SENT', message: 'The vendor has not sent a form yet' } }, 404);
  }
  const version = await dbTemplateVersion(versionId);
  if (!version) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Form version not found' } }, 404);
  const schema = formSchemaSchema.parse(version.schema) as FormSchema;
  const slugs = schema.sections.flatMap((section) => section.fields.map((field) => field.slug).filter(Boolean) as string[]);
  const profile = await dbSlugProfile(customerId, application.pet_id ? String(application.pet_id) : null);
  const resolved = resolveSlugValues(profile, slugs);
  const prefilled: Record<string, string> = {};
  for (const field of schema.sections.flatMap((section) => section.fields)) {
    if (!field.slug) continue;
    const hit = resolved.find((row) => row.slug === field.slug && row.value);
    if (hit?.value) prefilled[field.key] = hit.value;
  }
  const latest = await dbLatestSubmission(String(application.id));
  return c.json({
    success: true,
    data: {
      applicationId: application.id,
      templateVersionId: version.id,
      schema,
      prefilled,
      answers: latest?.answers || {},
      changeNotes: latest?.status === 'changes_requested' ? latest.change_notes || {} : {},
      revision: latest ? Number(latest.revision) : 0,
      status: application.status,
    },
  });
}
