import type { Context } from 'hono';
import {
  mapWpayAdminHandlerError,
  wpayAdminSuccessResponse,
} from '../../shared/wpay-admin-response.helpers';
import type { DashboardAdminRouteDeps } from '../routes/dashboard-admin.routes';
import {
  DashboardMetricsLoadError,
  WARMPAWZ_PAY_DASHBOARD_LOG_PREFIX,
} from '../services/warmpawz-pay-dashboard.service';

export async function dashboardGetHandler(
  c: Context,
  deps: DashboardAdminRouteDeps,
): Promise<Response> {
  console.info(`${WARMPAWZ_PAY_DASHBOARD_LOG_PREFIX} GET /admin/warmpawz-pay/dashboard`);

  try {
    const data = await deps.dashboardService.getDashboard();
    return wpayAdminSuccessResponse(c, data);
  } catch (error) {
    if (error instanceof DashboardMetricsLoadError) {
      console.error(
        `${WARMPAWZ_PAY_DASHBOARD_LOG_PREFIX} Repository failure`,
        error.cause ?? error,
      );
    } else {
      console.error(`${WARMPAWZ_PAY_DASHBOARD_LOG_PREFIX} Unexpected error`, error);
    }
    return mapWpayAdminHandlerError(c, error);
  }
}
