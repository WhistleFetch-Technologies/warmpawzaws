import { wpayConvenienceSettingsRepository } from '../../../warmpawz-pay/repositories/wpay-convenience-settings.repository';
import { scheduleWpayPayBillShadow } from '../../../../discount-engine/adapters/wpay-pay-bill-shadow';
import type { WpayVendorListDbRow } from '../repos/wpay-vendors-list.repo';
import { resolveWpayVendorCommercialConfig } from './wpay-commercial-config';
import {
  buildWpayCommercialSnapshot,
  computeWpayCommercialQuote,
  computeWpayDiscountQuote,
  type WpayCommercialQuote,
  type WpayDiscountQuote,
} from './wpay-discount';

export type WpayWithholdQuoteResult = {
  commercialModel: 'withhold';
  quote: WpayDiscountQuote;
  payableAmount: number;
  metadata: Record<string, unknown>;
};

export type WpayTierQuoteResult = {
  commercialModel: 'tier_commission';
  quote: WpayCommercialQuote;
  payableAmount: number;
  metadata: Record<string, unknown>;
};

export type WpayResolvedPayQuote = WpayWithholdQuoteResult | WpayTierQuoteResult;

/** Resolve Pay Bill quote for initiate/verify (tier commission vs historical withhold). */
export async function resolveWpayPayQuote(params: {
  vendorRow: WpayVendorListDbRow;
  quotedAmount: number;
  customerId?: string;
  /** @deprecated Ignored — appointment credit unwired from Pay Bill. */
  appointmentFeeCredit?: number;
}): Promise<WpayResolvedPayQuote> {
  const config = resolveWpayVendorCommercialConfig(params.vendorRow);

  let resolved: WpayResolvedPayQuote;
  if (config.commercialModel === 'tier_commission') {
    const settings = await wpayConvenienceSettingsRepository.getConvenienceSettings();
    const quote = computeWpayCommercialQuote({
      quotedAmount: params.quotedAmount,
      commissionPercent: config.commissionPercent,
      discountPercent: config.discountPercent,
      platformFee: settings.platformFee,
      platformFeeMode: settings.platformFeeMode,
      platformFeeGstRate: settings.platformFeeGstRate,
      convenienceFee: settings.convenienceFee,
      convenienceFeeMode: settings.convenienceFeeMode,
      convenienceGstRate: settings.convenienceGstRate,
      platformGstRate: settings.platformGstRate,
      burnMode: settings.burnMode,
    });

    resolved = {
      commercialModel: 'tier_commission',
      quote,
      payableAmount: quote.payNowAmount,
      metadata: buildWpayCommercialSnapshot(quote, {
        tierId: config.tierId,
        tierName: config.tierName,
      }),
    };
  } else {
    const quote = computeWpayDiscountQuote(params.quotedAmount, config.discountPercent);
    resolved = {
      commercialModel: 'withhold',
      quote,
      payableAmount: quote.payableAmount,
      metadata: {
        commercialModel: 'withhold',
        quotedOriginalAmount: quote.originalAmount,
        quotedDiscountAmount: quote.discountAmount,
        quotedDiscountPercent: quote.discountPercent,
        billBase: quote.billBase,
        appointmentFeeCredit: 0,
        platformWithholdPercent: config.platformWithholdPercent,
      },
    };
  }

  try {
    scheduleWpayPayBillShadow({
      quotedAmount: params.quotedAmount,
      vendorId: params.vendorRow.vendor_id,
      customerId: params.customerId,
      wpayDiscountAmount: resolved.quote.discountAmount,
      wpayDiscountPercent: resolved.quote.discountPercent,
    });
  } catch (err) {
    console.warn('[pbe-wpay-shadow] schedule failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return resolved;
}
