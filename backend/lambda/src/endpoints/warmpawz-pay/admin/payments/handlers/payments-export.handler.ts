import type { Context } from 'hono';
import { CatalogueErrorCode } from '../../catalogue/dto/catalogue.errors';
import { mapWpayAdminHandlerError } from '../../shared/wpay-admin-response.helpers';
import { WpayPaymentsExportTooLargeError } from '../../../repositories/wpay-payments-admin.repository';
import { parsePaymentsExportQuery } from '../dto/payments.requests';
import type { PaymentsAdminRouteDeps } from '../routes/payments-admin.routes';

export async function paymentsExportHandler(
  c: Context,
  deps: PaymentsAdminRouteDeps,
): Promise<Response> {
  try {
    const query = parsePaymentsExportQuery(c.req.query());
    const { buffer, filename } = await deps.paymentsService.exportPaymentsXlsx(query);
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof WpayPaymentsExportTooLargeError) {
      return c.json(
        {
          success: false,
          error: {
            code: CatalogueErrorCode.VALIDATION_ERROR,
            message: error.message,
          },
        },
        400,
      );
    }
    return mapWpayAdminHandlerError(c, error);
  }
}
