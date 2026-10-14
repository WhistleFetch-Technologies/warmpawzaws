import { query, withTransaction } from '../../../../database/rds-connection';
import type {
  CommissionTermsInput,
  PayoutScheduleInput,
  VendorLinkCreateInput,
  VendorLinkUpdateInput,
} from '../dto/insurance-admin.requests';
import type { InsuranceVendorCandidateDTO } from '../dto/insurance-admin.responses';
import { dbInsertCommissionTerms } from './commission-terms.repo';
import { dbClearLinkPayoutSchedule, dbSaveLinkPayoutSchedule } from './payout-schedules.repo';
import { dbCloseOpenPayoutWindows } from './payouts.repo';
import { isApprovedVendorStatus } from './readiness.repo';
import { isoDate, isoTs, num, str, vendorDisplayName, type Row } from './row-mappers';

export const INSURANCE_ROLE_NAMES = ['insurance', 'pet_insurance'] as const;

export interface VendorLinkRow {
  readonly id: string;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly vendorPhone: string | null;
  readonly vendorStatus: string | null;
  readonly companyId: string;
  readonly companyName: string;
  readonly authorisationRef: string | null;
  readonly agencyCode: string | null;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly status: 'active' | 'suspended' | 'ended';
  readonly notes: string | null;
  readonly createdAt: string;
}

const LINK_SELECT = `
  SELECT l.*, v.business_name, v.owner_name, v.phone AS vendor_phone, v.status AS vendor_status,
         ic.name AS company_name
  FROM insurance_vendor_companies l
  JOIN vendors v ON v.id = l.vendor_id
  JOIN insurance_companies ic ON ic.id = l.company_id`;

function mapLink(r: Row): VendorLinkRow {
  return {
    id: String(r.id),
    vendorId: String(r.vendor_id),
    vendorName: vendorDisplayName(r),
    vendorPhone: str(r.vendor_phone),
    vendorStatus: str(r.vendor_status),
    companyId: String(r.company_id),
    companyName: String(r.company_name),
    authorisationRef: str(r.authorisation_ref),
    agencyCode: str(r.agency_code),
    effectiveFrom: isoDate(r.effective_from) ?? '',
    effectiveTo: isoDate(r.effective_to),
    status: (str(r.status) ?? 'active') as VendorLinkRow['status'],
    notes: str(r.notes),
    createdAt: isoTs(r.created_at) ?? '',
  };
}

export async function dbListVendorLinks(filter: {
  companyId?: string;
  vendorId?: string;
}): Promise<VendorLinkRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.companyId) {
    params.push(filter.companyId);
    where.push(`l.company_id = $${params.length}::uuid`);
  }
  if (filter.vendorId) {
    params.push(filter.vendorId);
    where.push(`l.vendor_id = $${params.length}::uuid`);
  }
  const res = await query(
    `${LINK_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ic.name ASC, v.business_name ASC NULLS LAST`,
    params,
  );
  return (res.rows as Row[]).map(mapLink);
}

export async function dbGetVendorLink(id: string): Promise<VendorLinkRow | null> {
  const res = await query(`${LINK_SELECT} WHERE l.id = $1::uuid`, [id]);
  const row = res.rows[0] as Row | undefined;
  return row ? mapLink(row) : null;
}

export interface InsuranceVendorState {
  readonly isInsuranceVendor: boolean;
  readonly isActive: boolean;
  readonly isApproved: boolean;
  readonly name: string;
}

export async function dbGetInsuranceVendorState(vendorId: string): Promise<InsuranceVendorState | null> {
  const res = await query(
    `SELECT v.business_name, v.owner_name, v.status, v.is_active,
            (r.name = ANY($2::text[])) AS is_insurance
     FROM vendors v LEFT JOIN roles r ON r.id = v.role_id
     WHERE v.id = $1::uuid LIMIT 1`,
    [vendorId, [...INSURANCE_ROLE_NAMES]],
  );
  const row = res.rows[0] as Row | undefined;
  if (!row) return null;
  return {
    isInsuranceVendor: row.is_insurance === true,
    isActive: row.is_active === true,
    isApproved: isApprovedVendorStatus(row.status),
    name: vendorDisplayName(row),
  };
}

export async function dbFindVendorLinkByPair(vendorId: string, companyId: string): Promise<VendorLinkRow | null> {
  const res = await query(`${LINK_SELECT} WHERE l.vendor_id = $1::uuid AND l.company_id = $2::uuid`, [
    vendorId,
    companyId,
  ]);
  const row = res.rows[0] as Row | undefined;
  return row ? mapLink(row) : null;
}

/** Re-assigning a vendor whose link was ended reuses the row (one link per vendor-company pair). */
export async function dbReactivateVendorLinkWithTerms(
  linkId: string,
  input: VendorLinkCreateInput,
  actorId: string | null,
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE insurance_vendor_companies SET
         status = 'active', authorisation_ref = $2, agency_code = $3, effective_from = $4::date,
         effective_to = $5::date, notes = $6, updated_by = $7, updated_at = NOW()
       WHERE id = $1::uuid`,
      [
        linkId,
        input.authorisationRef,
        input.agencyCode,
        input.effectiveFrom,
        input.effectiveTo ?? null,
        input.notes,
        actorId,
      ],
    );
    await dbInsertCommissionTerms(linkId, { ...input.terms }, actorId, client);
  });
}

export async function dbApplyVendorLinkConfig(
  linkId: string,
  change: { terms: CommissionTermsInput | null; schedule: PayoutScheduleInput | 'default' | null },
  actorId: string | null,
): Promise<void> {
  await withTransaction(async (client) => {
    if (change.terms) await dbInsertCommissionTerms(linkId, change.terms, actorId, client);
    if (change.schedule) {
      if (change.schedule === 'default') await dbClearLinkPayoutSchedule(linkId, client);
      else await dbSaveLinkPayoutSchedule(linkId, change.schedule, actorId, client);
      await dbCloseOpenPayoutWindows(linkId, client);
    }
  });
}

export async function dbCreateVendorLinkWithTerms(
  input: VendorLinkCreateInput,
  actorId: string | null,
): Promise<string> {
  return withTransaction(async (client) => {
    const res = await client.query(
      `INSERT INTO insurance_vendor_companies (
         vendor_id, company_id, authorisation_ref, agency_code, effective_from, effective_to,
         notes, created_by, updated_by
       ) VALUES ($1::uuid, $2::uuid, $3, $4, $5::date, $6::date, $7, $8, $8)
       RETURNING id`,
      [
        input.vendorId,
        input.companyId,
        input.authorisationRef,
        input.agencyCode,
        input.effectiveFrom,
        input.effectiveTo ?? null,
        input.notes,
        actorId,
      ],
    );
    const id = String(res.rows[0].id);
    const terms: CommissionTermsInput = { ...input.terms };
    await dbInsertCommissionTerms(id, terms, actorId, client);
    return id;
  });
}

export async function dbUpdateVendorLink(
  id: string,
  patch: VendorLinkUpdateInput,
  actorId: string | null,
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown, cast = '') => {
    params.push(value);
    sets.push(`${column} = $${params.length}${cast}`);
  };
  if (patch.authorisationRef !== undefined) add('authorisation_ref', patch.authorisationRef);
  if (patch.agencyCode !== undefined) add('agency_code', patch.agencyCode);
  if (patch.effectiveFrom !== undefined) add('effective_from', patch.effectiveFrom, '::date');
  if (patch.effectiveTo !== undefined) add('effective_to', patch.effectiveTo, '::date');
  if (patch.status !== undefined) add('status', patch.status);
  if (patch.notes !== undefined) add('notes', patch.notes);
  add('updated_by', actorId);
  params.push(id);
  const res = await query(
    `UPDATE insurance_vendor_companies SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length}::uuid`,
    params,
  );
  return (res.rowCount ?? 0) > 0;
}

export async function dbCountActiveVendorLinks(): Promise<number> {
  const res = await query(
    `SELECT COUNT(*)::int AS n FROM insurance_vendor_companies WHERE status = 'active'`,
  );
  return num(res.rows[0]?.n);
}

export async function dbListInsuranceVendorCandidates(
  search: string | undefined,
): Promise<InsuranceVendorCandidateDTO[]> {
  const params: unknown[] = [[...INSURANCE_ROLE_NAMES]];
  let filter = '';
  if (search) {
    params.push(`%${search}%`);
    filter = `AND (v.business_name ILIKE $2 OR v.owner_name ILIKE $2 OR v.phone ILIKE $2 OR v.email ILIKE $2)`;
  }
  const res = await query(
    `SELECT v.id, v.business_name, v.owner_name, v.phone, v.email, v.status, v.is_active,
       (SELECT COUNT(*)::int FROM insurance_vendor_companies l WHERE l.vendor_id = v.id) AS linked
     FROM vendors v JOIN roles r ON r.id = v.role_id
     WHERE r.name = ANY($1::text[]) ${filter}
     ORDER BY v.is_active DESC, v.business_name ASC NULLS LAST
     LIMIT 50`,
    params,
  );
  return (res.rows as Row[]).map((r) => ({
    vendorId: String(r.id),
    name: vendorDisplayName(r),
    phone: str(r.phone),
    email: str(r.email),
    status: str(r.status),
    isActive: r.is_active === true,
    isApproved: isApprovedVendorStatus(r.status),
    linkedCompanyCount: num(r.linked),
  }));
}
