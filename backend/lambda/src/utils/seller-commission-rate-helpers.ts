import { query } from '../database/rds-connection';

export async function getSellerMonthlyRevenue(vendorId: string): Promise<number> {
  try {
    const revenueRes = await query(
      `SELECT COALESCE(SUM(total_amount), 0) AS revenue
       FROM orders
       WHERE vendor_id = $1
         AND order_status != 'cancelled'
         AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      [vendorId]
    );
    return parseFloat(revenueRes.rows?.[0]?.revenue || '0');
  } catch {
    return 0;
  }
}
