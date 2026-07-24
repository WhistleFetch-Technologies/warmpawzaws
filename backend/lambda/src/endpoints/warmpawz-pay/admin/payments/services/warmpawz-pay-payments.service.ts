import { resolveMerchantDisplayName } from '../../../shared/merchant/merchant-display-name.resolver';
import { resolveMerchantServiceCategory } from '../../../shared/merchant/merchant-service-category.resolver';
import {
  dbWpayAdminPaymentsPage,
  type WpayAdminPaymentDbRow,
} from '../../../repositories/wpay-payments-admin.repository';
import type { WpayAdminPaymentItemDTO, WpayAdminPaymentsListDTO } from '../dto/payments.responses';
import type { PaymentsListQuery } from '../dto/payments.requests';

function mapPaymentRow(row: WpayAdminPaymentDbRow): WpayAdminPaymentItemDTO {
  const categoryMeta = resolveMerchantServiceCategory({
    customerService: row.customer_service,
    roleCategory: row.role_category,
    roleConfig: row.role_config,
    legacyCategory: row.legacy_category,
    roleName: row.role_name,
    roleDisplayName: row.role_display_name,
  });

  const discountPercent = Number(row.discount_percent ?? 0);
  const originalAmount = Number(row.original_amount ?? 0);
  const discountAmount = Number(row.discount_amount ?? 0);
  const payableAmount = Number(row.payable_amount ?? 0);

  return {
    paymentId: row.payment_id,
    customer: {
      name: String(row.customer_name ?? '').trim() || 'Customer',
      phone: String(row.customer_phone ?? '').trim(),
    },
    vendor: {
      name: resolveMerchantDisplayName({
        businessName: row.business_name,
        ownerName: row.owner_name,
        vendorType: row.vendor_type,
        isSoloProvider: String(row.vendor_type ?? '').toLowerCase() === 'solo',
      }),
      category: categoryMeta.categoryDisplay,
    },
    originalAmount,
    discountPercent: Number.isFinite(discountPercent) ? discountPercent : 0,
    discountAmount,
    payableAmount,
    paidAt: row.paid_at,
  };
}

export class WarmpawzPayPaymentsService {
  async listPayments(query: PaymentsListQuery): Promise<WpayAdminPaymentsListDTO> {
    const { rows, total } = await dbWpayAdminPaymentsPage({
      page: query.page,
      pageSize: query.pageSize,
    });

    const totalPages = total > 0 ? Math.ceil(total / query.pageSize) : 0;

    return {
      items: rows.map(mapPaymentRow),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages,
    };
  }
}

export const warmpawzPayPaymentsService = new WarmpawzPayPaymentsService();
