/**
 * Guards update_health_record loyalty awards — vaccination / pet profile only.
 */

import { query } from '../database/rds-connection';

type HealthRecordRef = { type?: string; id?: string };

export async function isUpdateHealthRecordAwardEligible(
  reference?: HealthRecordRef
): Promise<boolean> {
  if (!reference?.type || !reference.id) {
    return false;
  }

  if (reference.type === 'pet') {
    return true;
  }

  if (reference.type === 'medical_record') {
    const res = await query(
      `SELECT record_type FROM medical_records WHERE id = $1 LIMIT 1`,
      [reference.id]
    );
    const recordType = String(res.rows?.[0]?.record_type || '').toLowerCase();
    return recordType === 'vaccination';
  }

  return false;
}
