import type { PoolClient } from 'pg';
import { query } from '../../../../database/rds-connection';
import { describeTerms, type CommissionBasis, type CommissionTerms } from '../domain/commission';
import type { CommissionTermsInput } from '../dto/insurance-admin.requests';
import type { CommissionTermsDTO } from '../dto/insurance-admin.responses';
import { isoDate, isoTs, num, numOrNull, str, type Row } from './row-mappers';

export function mapTermsRow(r: Row): CommissionTermsDTO {
  const terms: CommissionTerms = {
    basis: String(r.basis) as CommissionBasis,
    rate: num(r.rate),
    vendorCommissionRate: numOrNull(r.vendor_commission_rate),
    gstRate: num(r.gst_rate),
    effectiveFrom: isoDate(r.effective_from) ?? '',
  };
  return {
    id: String(r.id),
    ...terms,
    notes: str(r.notes),
    description: describeTerms(terms),
    createdAt: isoTs(r.created_at) ?? '',
  };
}

export async function dbListCommissionTerms(vendorCompanyId: string): Promise<CommissionTermsDTO[]> {
  const res = await query(
    `SELECT * FROM insurance_commission_terms
     WHERE vendor_company_id = $1::uuid
     ORDER BY effective_from DESC, created_at DESC`,
    [vendorCompanyId],
  );
  return (res.rows as Row[]).map(mapTermsRow);
}

/** Every link's terms, keyed by link id. */
export async function dbListAllCommissionTerms(): Promise<Map<string, CommissionTermsDTO[]>> {
  const res = await query(
    `SELECT * FROM insurance_commission_terms ORDER BY effective_from ASC, created_at ASC`,
  );
  const out = new Map<string, CommissionTermsDTO[]>();
  for (const r of res.rows as Row[]) {
    const linkId = String(r.vendor_company_id);
    const list = out.get(linkId) ?? [];
    list.push(mapTermsRow(r));
    out.set(linkId, list);
  }
  return out;
}

export async function dbInsertCommissionTerms(
  vendorCompanyId: string,
  terms: CommissionTermsInput,
  actorId: string | null,
  client?: PoolClient,
): Promise<void> {
  const sql = `INSERT INTO insurance_commission_terms (
      vendor_company_id, basis, rate, vendor_commission_rate, gst_rate, effective_from, notes, created_by
    ) VALUES ($1::uuid, $2, $3, $4, $5, $6::date, $7, $8)`;
  const params = [
    vendorCompanyId,
    terms.basis,
    terms.rate,
    terms.vendorCommissionRate ?? null,
    terms.gstRate,
    terms.effectiveFrom,
    terms.notes,
    actorId,
  ];
  if (client) await client.query(sql, params);
  else await query(sql, params);
}
