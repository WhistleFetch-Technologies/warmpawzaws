import { query } from '../../../../database/rds-connection';
import {
  PLATFORM_CUSTOMER_LEGAL_VERSION,
  WPAY_LEGAL_ACCEPTANCE_SOURCE,
} from '../shared/wpay-legal-acceptance';

export type CustomerLegalAcceptanceRow = {
  id: string;
  customer_id: string;
  policy_version: string;
  source: string;
  accepted_at: string;
};

export async function dbFindCustomerLegalAcceptance(
  customerId: string,
  policyVersion: string = PLATFORM_CUSTOMER_LEGAL_VERSION,
): Promise<CustomerLegalAcceptanceRow | null> {
  const result = await query(
    `SELECT id, customer_id, policy_version, source, accepted_at
     FROM customer_legal_acceptances
     WHERE customer_id = $1 AND policy_version = $2
     LIMIT 1`,
    [customerId, policyVersion],
  );
  return (result.rows[0] as CustomerLegalAcceptanceRow | undefined) ?? null;
}

export async function dbUpsertCustomerLegalAcceptance(params: {
  customerId: string;
  policyVersion?: string;
  source?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<CustomerLegalAcceptanceRow> {
  const policyVersion = params.policyVersion || PLATFORM_CUSTOMER_LEGAL_VERSION;
  const source = params.source || WPAY_LEGAL_ACCEPTANCE_SOURCE;
  const result = await query(
    `INSERT INTO customer_legal_acceptances (
       customer_id, policy_version, source, ip_address, user_agent
     ) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (customer_id, policy_version) DO UPDATE
       SET source = COALESCE(EXCLUDED.source, customer_legal_acceptances.source)
     RETURNING id, customer_id, policy_version, source, accepted_at`,
    [
      params.customerId,
      policyVersion,
      source,
      params.ipAddress ?? null,
      params.userAgent ?? null,
    ],
  );
  return result.rows[0] as CustomerLegalAcceptanceRow;
}
