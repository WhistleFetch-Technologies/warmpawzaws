import { wpayConvenienceSettingsRepository } from '../../../warmpawz-pay/repositories/wpay-convenience-settings.repository';
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
  /** Promo-engine ₹ off — only customer discount on Pay Bill. */
  engineDiscount?: number | null;
  /** At-home WAPPT fee credited after Q−D. */
  appointmentFeeCredit?: number;
  /** Global benefit cap reached: platform fee (and its GST) is not charged. */
  waivePlatformFee?: boolean;
}): Promise<WpayResolvedPayQuote> {
  const config = resolveWpayVendorCommercialConfig(params.vendorRow);
  const engineDiscount = Math.max(0, Number(params.engineDiscount) || 0);
  const appointmentFeeCredit = Math.max(0, Number(params.appointmentFeeCredit) || 0);

  if (config.commercialModel === 'tier_commission') {
    const settings = await wpayConvenienceSettingsRepository.getConvenienceSettings();
    const quote = computeWpayCommercialQuote({
      quotedAmount: params.quotedAmount,
      commissionPercent: config.commissionPercent,
      engineDiscount,
      appointmentFeeCredit,
      platformFee: params.waivePlatformFee ? 0 : settings.platformFee,
      platformFeeMode: settings.platformFeeMode,
      platformFeeGstRate: settings.platformFeeGstRate,
      // Convenience fee is retired on Pay Bill — only platform fee + GST is charged.
      convenienceFee: 0,
      convenienceFeeMode: 'fixed',
      convenienceGstRate: settings.convenienceGstRate,
      platformGstRate: settings.platformGstRate,
      burnMode: settings.burnMode,
    });

    const snapshot = buildWpayCommercialSnapshot(quote, {
      tierId: config.tierId,
      tierName: config.tierName,
    });
    return {
      commercialModel: 'tier_commission',
      quote,
      payableAmount: quote.payNowAmount,
      metadata: params.waivePlatformFee
        ? { ...snapshot, platformFeeWaivedByBenefitCap: true }
        : snapshot,
    };
  }

  const quote = computeWpayDiscountQuote(params.quotedAmount, {
    engineDiscount,
    appointmentFeeCredit,
  });
  const metadata = {
    commercialModel: 'withhold' as const,
    quotedOriginalAmount: quote.originalAmount,
    quotedDiscountAmount: quote.discountAmount,
    quotedDiscountPercent: quote.discountPercent,
    billBase: quote.billBase,
    appointmentFeeCredit: quote.appointmentFeeCredit,
    platformWithholdPercent: config.platformWithholdPercent,
  };
  return {
    commercialModel: 'withhold',
    quote,
    payableAmount: quote.payableAmount,
    metadata,
  };
}
