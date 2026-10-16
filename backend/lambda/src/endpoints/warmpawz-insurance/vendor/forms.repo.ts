import { query, withTransaction } from '../../../database/rds-connection';
import { nextTemplateVersion } from '../shared/form-library';

type Row = Record<string, unknown>;

export async function dbVendorLinkedToCompany(vendorId: string, companyId: string): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM insurance_vendor_companies
     WHERE vendor_id = $1::uuid AND company_id = $2::uuid AND status = 'active' LIMIT 1`,
    [vendorId, companyId],
  );
  return (res.rows as Row[]).length > 0;
}

export async function dbListForms(vendorId: string): Promise<Row[]> {
  const res = await query(
    `SELECT t.*, v.version AS published_version
     FROM insurance_form_templates t
     LEFT JOIN insurance_form_template_versions v ON v.id = t.current_version_id
     WHERE t.vendor_id = $1::uuid
     ORDER BY t.updated_at DESC`,
    [vendorId],
  );
  return res.rows as Row[];
}

export async function dbGetForm(vendorId: string, templateId: string): Promise<Row | null> {
  const res = await query(
    `SELECT * FROM insurance_form_templates WHERE id = $1::uuid AND vendor_id = $2::uuid`,
    [templateId, vendorId],
  );
  return (res.rows as Row[])[0] || null;
}

export async function dbInsertForm(input: {
  vendorId: string;
  companyId: string;
  planId: string | null;
  name: string;
  schema: unknown;
}): Promise<Row> {
  const res = await query(
    `INSERT INTO insurance_form_templates (vendor_id, company_id, plan_id, name, status, draft_schema)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'draft', $5::jsonb)
     RETURNING *`,
    [input.vendorId, input.companyId, input.planId, input.name, JSON.stringify(input.schema)],
  );
  return res.rows[0] as Row;
}

export async function dbUpdateDraft(vendorId: string, templateId: string, name: string, schema: unknown): Promise<Row | null> {
  const res = await query(
    `UPDATE insurance_form_templates
     SET name = $3, draft_schema = $4::jsonb, updated_at = NOW()
     WHERE id = $1::uuid AND vendor_id = $2::uuid
     RETURNING *`,
    [templateId, vendorId, name, JSON.stringify(schema)],
  );
  return (res.rows as Row[])[0] || null;
}

export async function dbPublishForm(vendorId: string, templateId: string, actor: string | null): Promise<Row> {
  return withTransaction(async (client) => {
    const current = await client.query(
      `SELECT * FROM insurance_form_templates WHERE id = $1::uuid AND vendor_id = $2::uuid FOR UPDATE`,
      [templateId, vendorId],
    );
    const template = current.rows[0] as Row | undefined;
    if (!template) throw new Error('NOT_FOUND');
    const latest = await client.query(
      `SELECT COALESCE(MAX(version), 0)::int AS version
       FROM insurance_form_template_versions WHERE template_id = $1::uuid`,
      [templateId],
    );
    const version = nextTemplateVersion(Number(latest.rows[0]?.version || 0));
    const inserted = await client.query(
      `INSERT INTO insurance_form_template_versions (template_id, version, schema, published_by)
       VALUES ($1::uuid, $2, $3::jsonb, $4)
       RETURNING *`,
      [templateId, version, JSON.stringify(template.draft_schema), actor],
    );
    const versionRow = inserted.rows[0] as Row;
    await client.query(
      `UPDATE insurance_form_templates
       SET status = 'published', current_version_id = $2::uuid, updated_at = NOW()
       WHERE id = $1::uuid`,
      [templateId, versionRow.id],
    );
    return versionRow;
  });
}

export async function dbListVersions(vendorId: string, templateId: string): Promise<Row[]> {
  const res = await query(
    `SELECT v.*
     FROM insurance_form_template_versions v
     JOIN insurance_form_templates t ON t.id = v.template_id
     WHERE v.template_id = $1::uuid AND t.vendor_id = $2::uuid
     ORDER BY v.version ASC`,
    [templateId, vendorId],
  );
  return res.rows as Row[];
}

export async function dbActiveCompanyIdsForVendor(vendorId: string): Promise<string[]> {
  const res = await query(
    `SELECT company_id::text AS company_id
     FROM insurance_vendor_companies
     WHERE vendor_id = $1::uuid AND status = 'active'`,
    [vendorId],
  );
  return (res.rows as Row[]).map((row) => String(row.company_id));
}

export async function dbHasPublishedFormForCompany(vendorId: string, companyId: string): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM insurance_form_templates
     WHERE vendor_id = $1::uuid AND company_id = $2::uuid AND status = 'published'
     LIMIT 1`,
    [vendorId, companyId],
  );
  return (res.rows as Row[]).length > 0;
}

export async function dbEnsureDefaultPublishedForm(input: {
  vendorId: string;
  companyId: string;
  name: string;
  schema: unknown;
  actor: string | null;
}): Promise<Row | null> {
  if (await dbHasPublishedFormForCompany(input.vendorId, input.companyId)) return null;
  const form = await dbInsertForm({
    vendorId: input.vendorId,
    companyId: input.companyId,
    planId: null,
    name: input.name,
    schema: input.schema,
  });
  await dbPublishForm(input.vendorId, String(form.id), input.actor);
  return form;
}
