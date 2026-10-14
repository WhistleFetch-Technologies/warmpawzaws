import { query } from '../../../../database/rds-connection';
import type { CompanyInput } from '../dto/insurance-admin.requests';
import type { InsuranceCompanyDTO } from '../dto/insurance-admin.responses';
import { isoTs, num, str, textArray, type Row } from './row-mappers';

const COMPANY_SELECT = `
  SELECT ic.*,
    (SELECT COUNT(*)::int FROM insurance_vendor_companies l
      WHERE l.company_id = ic.id AND l.status = 'active') AS active_vendor_count,
    (SELECT COUNT(*)::int FROM insurance_applications a
      WHERE a.company_id = ic.id AND a.status IN ('policy_confirmed', 'policy_issued')) AS issued_policy_count
  FROM insurance_companies ic`;

function mapCompany(r: Row): InsuranceCompanyDTO {
  return {
    id: String(r.id),
    name: String(r.name),
    description: str(r.description),
    legalName: str(r.legal_name),
    providerCode: str(r.provider_code),
    logoUrl: str(r.logo_url),
    contactName: str(r.contact_name),
    contactEmail: str(r.contact_email),
    contactPhone: str(r.contact_phone),
    escalationContact: str(r.escalation_contact),
    products: textArray(r.products),
    integrationMode: (str(r.integration_mode) ?? 'manual') as InsuranceCompanyDTO['integrationMode'],
    status: (str(r.status) ?? 'active') as InsuranceCompanyDTO['status'],
    notes: str(r.notes),
    paymentLinkDomains: textArray(r.payment_link_domains),
    activeVendorCount: num(r.active_vendor_count),
    issuedPolicyCount: num(r.issued_policy_count),
    createdAt: isoTs(r.created_at) ?? '',
    updatedAt: isoTs(r.updated_at) ?? '',
  };
}

export async function dbListInsuranceCompanies(): Promise<InsuranceCompanyDTO[]> {
  const res = await query(`${COMPANY_SELECT} ORDER BY ic.status ASC, LOWER(ic.name) ASC`);
  return (res.rows as Row[]).map(mapCompany);
}

export async function dbGetInsuranceCompany(id: string): Promise<InsuranceCompanyDTO | null> {
  const res = await query(`${COMPANY_SELECT} WHERE ic.id = $1::uuid`, [id]);
  const row = res.rows[0] as Row | undefined;
  return row ? mapCompany(row) : null;
}

function companyParams(input: CompanyInput): unknown[] {
  return [
    input.name,
    input.legalName,
    input.providerCode,
    input.logoUrl,
    input.contactName,
    input.contactEmail,
    input.contactPhone,
    input.escalationContact,
    input.products,
    input.integrationMode,
    input.status,
    input.notes,
    input.paymentLinkDomains,
    input.description,
  ];
}

export async function dbInsertInsuranceCompany(input: CompanyInput, actorId: string | null): Promise<string> {
  const res = await query(
    `INSERT INTO insurance_companies (
       name, legal_name, provider_code, logo_url, contact_name, contact_email, contact_phone,
       escalation_contact, products, integration_mode, status, notes, payment_link_domains, description,
       created_by, updated_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, $11, $12, $13::text[], $14, $15, $15)
     RETURNING id`,
    [...companyParams(input), actorId],
  );
  return String(res.rows[0].id);
}

export async function dbUpdateInsuranceCompany(
  id: string,
  input: CompanyInput,
  actorId: string | null,
): Promise<boolean> {
  const res = await query(
    `UPDATE insurance_companies SET
       name = $1, legal_name = $2, provider_code = $3, logo_url = $4, contact_name = $5,
       contact_email = $6, contact_phone = $7, escalation_contact = $8, products = $9::text[],
       integration_mode = $10, status = $11, notes = $12, payment_link_domains = $13::text[],
       description = $14, updated_by = $15, updated_at = NOW()
     WHERE id = $16::uuid`,
    [...companyParams(input), actorId, id],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function dbCountActiveInsuranceCompanies(): Promise<number> {
  const res = await query(`SELECT COUNT(*)::int AS n FROM insurance_companies WHERE status = 'active'`);
  return num(res.rows[0]?.n);
}
