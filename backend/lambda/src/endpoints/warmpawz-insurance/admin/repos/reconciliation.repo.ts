import { query } from '../../../../database/rds-connection';
import type { CompletedPolicyRecord } from '../domain/reconciliation';
import { isoDate, isoTs, num, str, vendorDisplayName, type Row } from './row-mappers';

export interface CompletedPolicyFilter {
  readonly from: string;
  readonly to: string;
  readonly companyId?: string;
  readonly vendorId?: string;
  readonly search?: string;
}

const POLICY_DATE = `((a.policy_issued_at AT TIME ZONE 'Asia/Kolkata')::date)`;

/** Same population as the payout ledger (dbListIssuedPolicies), filtered by confirmation date. */
export async function dbListCompletedPolicies(filter: CompletedPolicyFilter): Promise<CompletedPolicyRecord[]> {
  const params: unknown[] = [filter.from, filter.to];
  const where = [
    `a.status IN ('policy_confirmed', 'policy_issued', 'free_look_cancelled')`,
    `a.policy_number IS NOT NULL`,
    `a.policy_issued_at IS NOT NULL`,
    `${POLICY_DATE} BETWEEN $1::date AND $2::date`,
  ];
  if (filter.companyId) {
    params.push(filter.companyId);
    where.push(`a.company_id = $${params.length}::uuid`);
  }
  if (filter.vendorId) {
    params.push(filter.vendorId);
    where.push(`a.vendor_id = $${params.length}::uuid`);
  }
  if (filter.search) {
    params.push(`%${filter.search}%`);
    const n = params.length;
    where.push(
      `(c.full_name ILIKE $${n} OR c.phone ILIKE $${n} OR a.policy_number ILIKE $${n}
        OR v.business_name ILIKE $${n} OR v.owner_name ILIKE $${n})`,
    );
  }
  const res = await query(
    `SELECT a.id, a.status, a.vendor_id, a.company_id, a.policy_number, a.premium_amount,
            ${POLICY_DATE} AS policy_date, pi.uploaded_at,
            c.full_name AS customer_name, c.phone AS customer_phone,
            p.name AS pet_name, p.species AS pet_species,
            ic.name AS company_name, ic.logo_url AS company_logo_url,
            v.business_name, v.owner_name
     FROM insurance_applications a
     JOIN customers c ON c.id = a.customer_id
     JOIN vendors v ON v.id = a.vendor_id
     JOIN insurance_companies ic ON ic.id = a.company_id
     LEFT JOIN pets p ON p.id = a.pet_id
     LEFT JOIN insurance_policies_issued pi ON pi.application_id = a.id
     WHERE ${where.join(' AND ')}
     ORDER BY a.policy_issued_at DESC, a.id`,
    params,
  );
  return (res.rows as Row[]).map((r) => ({
    applicationId: String(r.id),
    applicationStatus: String(r.status),
    policyNumber: String(r.policy_number),
    policyDate: isoDate(r.policy_date) ?? '',
    addedAt: isoTs(r.uploaded_at),
    premium: num(r.premium_amount),
    customerName: str(r.customer_name),
    customerPhone: str(r.customer_phone),
    petName: str(r.pet_name),
    petSpecies: str(r.pet_species),
    companyId: String(r.company_id),
    companyName: str(r.company_name) ?? 'Unknown company',
    companyLogoUrl: str(r.company_logo_url),
    vendorId: String(r.vendor_id),
    vendorName: vendorDisplayName(r),
  }));
}

export interface PolicyDocumentsRow {
  readonly applicationId: string;
  readonly policyNumber: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly legacyDocumentUrl: string | null;
  readonly documents: ReadonlyArray<{ s3Key: string; name: string; mime: string | null }>;
}

export async function dbGetPolicyDocuments(applicationId: string): Promise<PolicyDocumentsRow | null> {
  const res = await query(
    `SELECT a.id, COALESCE(pi.policy_number, a.policy_number) AS policy_number,
            pi.start_date, pi.end_date, pi.documents, a.policy_document_url
     FROM insurance_applications a
     LEFT JOIN insurance_policies_issued pi ON pi.application_id = a.id
     WHERE a.id = $1::uuid`,
    [applicationId],
  );
  const r = (res.rows as Row[])[0];
  if (!r) return null;
  const raw = Array.isArray(r.documents) ? (r.documents as Row[]) : [];
  return {
    applicationId: String(r.id),
    policyNumber: str(r.policy_number),
    startDate: isoDate(r.start_date),
    endDate: isoDate(r.end_date),
    legacyDocumentUrl: str(r.policy_document_url),
    documents: raw
      .map((d) => ({ s3Key: str(d.s3Key) ?? '', name: str(d.name) ?? 'Document', mime: str(d.mime) }))
      .filter((d) => d.s3Key !== ''),
  };
}
