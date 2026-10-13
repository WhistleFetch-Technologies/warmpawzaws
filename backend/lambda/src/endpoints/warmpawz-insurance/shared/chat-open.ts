import { isTerminalInsuranceStatus, normalizeInsuranceStatus } from '@warmpawz/shared-types';
import { query } from '../../../database/rds-connection';

/** Keep consultation chat open while the insurance application is still active. */
export async function insuranceApplicationKeepsChatOpen(bookingId: string): Promise<boolean> {
  try {
    const res = await query(
      `SELECT status FROM insurance_applications WHERE booking_id = $1::uuid LIMIT 1`,
      [bookingId],
    );
    const status = normalizeInsuranceStatus(res.rows[0]?.status);
    if (!status) return false;
    return !isTerminalInsuranceStatus(status);
  } catch {
    return false;
  }
}
