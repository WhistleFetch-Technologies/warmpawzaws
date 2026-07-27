import type { Context } from 'hono';
import {
  fetchWapptDashboardMetrics,
  listWapptAdminBookings,
} from '../../../repositories/wappt-dashboard.repository';
import { WapptAdminSuccessResponse } from '../../shared/wappt-admin-response.helpers';

export async function wapptDashboardGetHandler(c: Context): Promise<Response> {
  const metrics = await fetchWapptDashboardMetrics();
  return WapptAdminSuccessResponse(c, metrics);
}

export async function wapptBookingsListHandler(c: Context): Promise<Response> {
  const page = Math.max(1, Number(c.req.query('page') || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize') || 20) || 20));
  const data = await listWapptAdminBookings({ page, pageSize });
  return WapptAdminSuccessResponse(c, data);
}
