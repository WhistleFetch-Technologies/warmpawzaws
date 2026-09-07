import { resolveMerchantDisplayName } from '../../../shared/merchant/merchant-display-name.resolver';
import { resolveMerchantServiceCategory } from '../../../shared/merchant/merchant-service-category.resolver';
import {
  clampWpayWithholdPercent,
  computeWpayVendorSettlement,
} from '../../../shared/pricing/wpay-vendor-settlement';
import { mapWpaySettlementLedgerStatus } from '../../../../customer/warmpawz-pay/shared/accrue-wpay-settlement';
import {
  dbWpayAdminPaymentsExport,
  dbWpayAdminPaymentsPage,
  dbWpayAdminSettlePaymentsByPaymentIds,
  dbWpayPlatformWithholdPercentByVendorIds,
  type WpayAdminPaymentDbRow,
  type WpayAdminPaymentsQueryFilters,
} from '../../../repositories/wpay-payments-admin.repository';
import type {
  WpayAdminPaymentItemDTO,
  WpayAdminPaymentsListDTO,
  WpayAdminPaymentsSettleDTO,
  WpayAdminPayoutStatus,
  WpayCommercialModel,
} from '../dto/payments.responses';
import type {
  PaymentsExportQuery,
  PaymentsListQuery,
  PaymentsSettleBody,
} from '../dto/payments.requests';
import {
  buildWpayPaymentsExportFilename,
  buildWpayPaymentsExportXlsx,
} from './wpay-payments-export.xlsx';

function toFiniteNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readBreakupNumber(
  breakup: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  if (!breakup) return null;
  return toFiniteNumber(breakup[key] as string | number | null | undefined);
}

function resolveCommercialModel(row: WpayAdminPaymentDbRow): WpayCommercialModel {
  const breakupModel = String(row.settlement_breakup?.commercialModel ?? '').trim();
  if (breakupModel === 'tier_commission') return 'tier_commission';
  const metaModel = String(row.payment_metadata?.commercialModel ?? '').trim();
  if (metaModel === 'tier_commission') return 'tier_commission';
  if (row.payment_metadata?.tierId || row.payment_metadata?.tierIdSnapshot) {
    return 'tier_commission';
  }
  return 'withhold';
}

function resolvePayoutStatus(row: WpayAdminPaymentDbRow): {
  payoutStatus: WpayAdminPayoutStatus;
  payoutSettledAt: string | null;
  settlementId: string | null;
} {
  const settlementId = row.settlement_id ? String(row.settlement_id) : null;
  if (!settlementId) {
    return { payoutStatus: 'unavailable', payoutSettledAt: null, settlementId: null };
  }
  const ledger = mapWpaySettlementLedgerStatus(row.settlement_status);
  if (ledger === 'settled') {
    return {
      payoutStatus: 'settled',
      payoutSettledAt: row.settlement_completed_at ? String(row.settlement_completed_at) : null,
      settlementId,
    };
  }
  return {
    payoutStatus: 'pending',
    payoutSettledAt: null,
    settlementId,
  };
}

export function resolveWpayAdminPaymentSettlement(
  row: WpayAdminPaymentDbRow,
  payableAmount: number,
  withholdByVendor: ReadonlyMap<string, number>,
): Pick<
  WpayAdminPaymentItemDTO,
  | 'platformWithholdPercent'
  | 'platformWithholdAmount'
  | 'vendorSettlementAmount'
  | 'settlementSource'
> {
  const vendorSettlementAmount = toFiniteNumber(row.vendor_settlement_amount);
  const platformWithholdAmount = toFiniteNumber(row.platform_withhold_amount);
  const persistedWithholdPercent = toFiniteNumber(row.platform_withhold_percent);

  if (vendorSettlementAmount != null && platformWithholdAmount != null) {
    const percent =
      persistedWithholdPercent != null
        ? clampWpayWithholdPercent(persistedWithholdPercent)
        : payableAmount > 0
          ? clampWpayWithholdPercent((platformWithholdAmount / payableAmount) * 100)
          : 0;

    return {
      platformWithholdPercent: percent,
      platformWithholdAmount,
      vendorSettlementAmount,
      settlementSource: 'persisted',
    };
  }

  const fallbackPercent = clampWpayWithholdPercent(
    withholdByVendor.get(String(row.vendor_id)) ?? 0,
  );
  const computed = computeWpayVendorSettlement(payableAmount, fallbackPercent);
  return {
    ...computed,
    settlementSource: 'computed',
  };
}

function toQueryFilters(
  query: Pick<PaymentsListQuery, 'dateFilter' | 'payoutStatus' | 'vendorSearch'>,
): WpayAdminPaymentsQueryFilters {
  return {
    dateFilter: query.dateFilter,
    payoutStatus: query.payoutStatus,
    vendorSearch: query.vendorSearch,
  };
}

function mapPaymentRow(
  row: WpayAdminPaymentDbRow,
  withholdByVendor: ReadonlyMap<string, number>,
): WpayAdminPaymentItemDTO {
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
  const commercialModel = resolveCommercialModel(row);
  const breakup = row.settlement_breakup ?? undefined;
  const meta = row.payment_metadata ?? undefined;
  const payout = resolvePayoutStatus(row);

  const base = {
    paymentId: row.payment_id,
    customer: {
      name: String(row.customer_name ?? '').trim() || 'Customer',
      phone: String(row.customer_phone ?? '').trim(),
    },
    vendor: {
      id: String(row.vendor_id),
      name: resolveMerchantDisplayName({
        businessName: row.business_name,
        ownerName: row.owner_name,
        vendorType: row.vendor_type,
        isSoloProvider: String(row.vendor_type ?? '').toLowerCase() === 'solo',
      }),
      category: categoryMeta.categoryDisplay,
      tierName:
        (breakup?.tierNameSnapshot as string | undefined) ??
        (meta?.tierNameSnapshot as string | undefined) ??
        null,
    },
    commercialModel,
    originalAmount,
    discountPercent: Number.isFinite(discountPercent) ? discountPercent : 0,
    discountAmount,
    payableAmount,
    paidAt: row.paid_at,
    settlementId: payout.settlementId,
    payoutStatus: payout.payoutStatus,
    payoutSettledAt: payout.payoutSettledAt,
  };

  if (commercialModel === 'tier_commission') {
    const vendorPayableAmount =
      readBreakupNumber(breakup, 'vendorPayableAmount') ??
      toFiniteNumber(row.vendor_settlement_amount) ??
      0;
    const wpayRevenueAmount =
      readBreakupNumber(breakup, 'wpayRevenueAmount') ??
      toFiniteNumber(row.platform_withhold_amount) ??
      0;
    const burnMode = Boolean(breakup?.burnMode ?? meta?.burnMode ?? false);
    const burnAmount = burnMode
      ? Math.round(Math.max(0, vendorPayableAmount - payableAmount) * 100) / 100
      : readBreakupNumber(breakup, 'burnAmount') ??
        toFiniteNumber(meta?.burnAmount as number | undefined) ??
        0;

    return {
      ...base,
      appointmentFeeCredit: 0,
      commissionPercent:
        readBreakupNumber(breakup, 'commissionPercentSnapshot') ??
        toFiniteNumber(meta?.commissionPercentSnapshot as number | undefined) ??
        undefined,
      vendorPayableAmount,
      wpayRevenueAmount,
      platformGstAmount:
        readBreakupNumber(breakup, 'platformGstAmount') ??
        toFiniteNumber(meta?.platformGstAmount as number | undefined) ??
        undefined,
      platformFee:
        readBreakupNumber(breakup, 'platformFee') ??
        toFiniteNumber(meta?.platformFee as number | undefined) ??
        undefined,
      platformFeeGstAmount:
        readBreakupNumber(breakup, 'platformFeeGstAmount') ??
        toFiniteNumber(meta?.platformFeeGstAmount as number | undefined) ??
        undefined,
      convenienceFee:
        readBreakupNumber(breakup, 'convenienceFee') ??
        toFiniteNumber(meta?.convenienceFee as number | undefined) ??
        undefined,
      convenienceGstAmount:
        readBreakupNumber(breakup, 'convenienceGstAmount') ??
        toFiniteNumber(meta?.convenienceGstAmount as number | undefined) ??
        undefined,
      finalGstAmount:
        readBreakupNumber(breakup, 'finalGstAmount') ??
        toFiniteNumber(meta?.finalGstAmount as number | undefined) ??
        undefined,
      burnMode,
      burnAmount,
      vendorSettlementAmount: vendorPayableAmount,
      settlementSource: row.vendor_settlement_amount != null ? 'persisted' : 'computed',
    };
  }

  const settlement = resolveWpayAdminPaymentSettlement(row, payableAmount, withholdByVendor);
  return {
    ...base,
    ...settlement,
  };
}

async function mapPaymentRows(rows: WpayAdminPaymentDbRow[]): Promise<WpayAdminPaymentItemDTO[]> {
  const needsFallback = rows.some(
    (row) =>
      resolveCommercialModel(row) === 'withhold' &&
      toFiniteNumber(row.vendor_settlement_amount) == null,
  );
  const withholdByVendor = needsFallback
    ? await dbWpayPlatformWithholdPercentByVendorIds(rows.map((row) => String(row.vendor_id)))
    : new Map<string, number>();
  return rows.map((row) => mapPaymentRow(row, withholdByVendor));
}

export class WarmpawzPayPaymentsService {
  async listPayments(query: PaymentsListQuery): Promise<WpayAdminPaymentsListDTO> {
    const { rows, total } = await dbWpayAdminPaymentsPage({
      page: query.page,
      pageSize: query.pageSize,
      filters: toQueryFilters(query),
    });

    const items = await mapPaymentRows(rows);
    const totalPages = total > 0 ? Math.ceil(total / query.pageSize) : 0;

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages,
    };
  }

  async exportPaymentsXlsx(
    query: PaymentsExportQuery,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const rows = await dbWpayAdminPaymentsExport(toQueryFilters(query));
    const items = await mapPaymentRows(rows);
    const buffer = await buildWpayPaymentsExportXlsx(items);
    return {
      buffer,
      filename: buildWpayPaymentsExportFilename(query.dateFilter),
    };
  }

  async settlePayments(body: PaymentsSettleBody): Promise<WpayAdminPaymentsSettleDTO> {
    const requested = [...new Set(body.paymentIds.map((id) => String(id).trim()).filter(Boolean))];
    const { settledPaymentIds } = await dbWpayAdminSettlePaymentsByPaymentIds(requested);
    const settledSet = new Set(settledPaymentIds);
    const skipped = requested
      .filter((paymentId) => !settledSet.has(paymentId))
      .map((paymentId) => ({
        paymentId,
        reason: 'Already settled, missing settlement row, or not a completed Warmpawz Pay payment',
      }));

    return {
      settledPaymentIds,
      settledCount: settledPaymentIds.length,
      skipped,
    };
  }
}

export const warmpawzPayPaymentsService = new WarmpawzPayPaymentsService();
