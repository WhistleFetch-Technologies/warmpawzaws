import { query } from '../database/rds-connection';

/** Vendor Terms + Privacy + Onboarding Agreement bundle version. */
export const PLATFORM_VENDOR_LEGAL_VERSION = 'vendor_tos_privacy_onboarding_v1';

export const VENDOR_LEGAL_ACCEPTANCE_SOURCE = 'vendor_onboarding';

export type VendorLegalAcceptanceRow = {
  id: string;
  vendor_identity_id: string;
  application_id: string | null;
  policy_version: string;
  source: string;
  accepted_at: string;
};

export function isVendorAgreedToTerms(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const v = (payload as Record<string, unknown>).agreedToTerms;
  return v === true || v === 'true' || v === 1 || v === '1';
}

export async function dbFindVendorLegalAcceptance(
  vendorIdentityId: string,
  policyVersion: string = PLATFORM_VENDOR_LEGAL_VERSION,
): Promise<VendorLegalAcceptanceRow | null> {
  const result = await query(
    `SELECT id, vendor_identity_id, application_id, policy_version, source, accepted_at
     FROM vendor_legal_acceptances
     WHERE vendor_identity_id = $1 AND policy_version = $2
     LIMIT 1`,
    [vendorIdentityId, policyVersion],
  );
  return (result.rows[0] as VendorLegalAcceptanceRow | undefined) ?? null;
}

export async function dbUpsertVendorLegalAcceptance(params: {
  vendorIdentityId: string;
  applicationId?: string | null;
  policyVersion?: string;
  source?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<VendorLegalAcceptanceRow> {
  const policyVersion = params.policyVersion || PLATFORM_VENDOR_LEGAL_VERSION;
  const source = params.source || VENDOR_LEGAL_ACCEPTANCE_SOURCE;
  const result = await query(
    `INSERT INTO vendor_legal_acceptances (
       vendor_identity_id, application_id, policy_version, source, ip_address, user_agent
     ) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (vendor_identity_id, policy_version) DO UPDATE
       SET
         application_id = COALESCE(EXCLUDED.application_id, vendor_legal_acceptances.application_id),
         source = COALESCE(EXCLUDED.source, vendor_legal_acceptances.source),
         ip_address = COALESCE(EXCLUDED.ip_address, vendor_legal_acceptances.ip_address),
         user_agent = COALESCE(EXCLUDED.user_agent, vendor_legal_acceptances.user_agent)
     RETURNING id, vendor_identity_id, application_id, policy_version, source, accepted_at`,
    [
      params.vendorIdentityId,
      params.applicationId ?? null,
      policyVersion,
      source,
      params.ipAddress ?? null,
      params.userAgent ?? null,
    ],
  );
  return result.rows[0] as VendorLegalAcceptanceRow;
}
