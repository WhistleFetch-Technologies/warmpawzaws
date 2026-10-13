import { query } from '../../../../database/rds-connection';
import type { PlanInput } from '../dto/insurance-admin.requests';
import type { InsurancePlanDTO } from '../dto/insurance-admin.responses';
import { isoTs, num, str, type Row } from './row-mappers';

function jsonValue(v: unknown): unknown {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

function stringList(v: unknown): string[] {
  const parsed = jsonValue(v);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function coverOptions(v: unknown): InsurancePlanDTO['coverOptions'] {
  const parsed = jsonValue(v);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        key: String(item.key ?? ''),
        label: String(item.label ?? ''),
        description: item.description == null ? undefined : String(item.description),
      };
    })
    .filter((row) => row.key && row.label);
}

function mapPlan(r: Row): InsurancePlanDTO {
  return {
    id: String(r.id),
    companyId: String(r.company_id),
    name: String(r.name),
    productType: String(r.product_type),
    highlights: stringList(r.highlights),
    premiumFrom: num(r.premium_from),
    premiumUnit: (str(r.premium_unit) ?? 'year') as InsurancePlanDTO['premiumUnit'],
    coverOptions: coverOptions(r.cover_options),
    sumInsuredOptions: stringList(r.sum_insured_options),
    copayOptions: stringList(r.copay_options),
    status: (str(r.status) ?? 'draft') as InsurancePlanDTO['status'],
    sortOrder: num(r.sort_order),
    createdAt: isoTs(r.created_at) ?? '',
    updatedAt: isoTs(r.updated_at) ?? '',
  };
}

const PLAN_COLUMNS = `
  id, company_id, name, product_type, highlights, premium_from, premium_unit,
  cover_options, sum_insured_options, copay_options, status, sort_order, created_at, updated_at
`;

export async function dbListCompanyPlans(companyId: string): Promise<InsurancePlanDTO[]> {
  const res = await query(
    `SELECT ${PLAN_COLUMNS} FROM insurance_company_plans
     WHERE company_id = $1::uuid
     ORDER BY sort_order ASC, LOWER(name) ASC`,
    [companyId],
  );
  return (res.rows as Row[]).map(mapPlan);
}

export async function dbGetPlan(id: string): Promise<InsurancePlanDTO | null> {
  const res = await query(`SELECT ${PLAN_COLUMNS} FROM insurance_company_plans WHERE id = $1::uuid`, [id]);
  const row = res.rows[0] as Row | undefined;
  return row ? mapPlan(row) : null;
}

function planParams(input: PlanInput): unknown[] {
  return [
    input.name,
    input.productType,
    JSON.stringify(input.highlights),
    input.premiumFrom,
    input.premiumUnit,
    JSON.stringify(input.coverOptions),
    JSON.stringify(input.sumInsuredOptions),
    JSON.stringify(input.copayOptions),
    input.sortOrder,
  ];
}

export async function dbInsertPlan(companyId: string, input: PlanInput, actorId: string | null): Promise<string> {
  const res = await query(
    `INSERT INTO insurance_company_plans (
       company_id, name, product_type, highlights, premium_from, premium_unit,
       cover_options, sum_insured_options, copay_options, sort_order, created_by, updated_by
     ) VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $11)
     RETURNING id`,
    [companyId, ...planParams(input), actorId],
  );
  return String(res.rows[0].id);
}

export async function dbUpdatePlan(id: string, input: PlanInput, actorId: string | null): Promise<boolean> {
  const res = await query(
    `UPDATE insurance_company_plans SET
       name = $1, product_type = $2, highlights = $3::jsonb, premium_from = $4, premium_unit = $5,
       cover_options = $6::jsonb, sum_insured_options = $7::jsonb, copay_options = $8::jsonb,
       sort_order = $9, updated_by = $10, updated_at = NOW()
     WHERE id = $11::uuid`,
    [...planParams(input), actorId, id],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function dbSetPlanStatus(
  id: string,
  status: 'draft' | 'published' | 'archived',
  actorId: string | null,
): Promise<boolean> {
  const res = await query(
    `UPDATE insurance_company_plans SET status = $2, updated_by = $3, updated_at = NOW() WHERE id = $1::uuid`,
    [id, status, actorId],
  );
  return (res.rowCount ?? 0) > 0;
}
