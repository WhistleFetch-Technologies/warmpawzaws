import { wpayConvenienceSettingsRepository } from '../../../warmpawz-pay/repositories/wpay-convenience-settings.repository';
import type { WpayVendorListDbRow } from '../repos/wpay-vendors-list.repo';
import { resolveWpayVendorCommercialConfig } from './wpay-commercial-config';
import {
  buildWpayCommercialSnapshot,
  computeWpayCommercialQuote,
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Resolve Pay Bill quote for initiate/verify (tier commission vs historical withhold). */
export async function resolveWpayPayQuote(params: {
  vendorRow: WpayVendorListDbRow;
  quotedAmount: number;
  /**
   * Promo-engine monetary discount (₹). Feeds fee guardrail headroom under Q.
   * Catalogue % stays 0 — engine is the only customer cut.
   */
  engineDiscountAmount?: number;
  /** @deprecated Ignored — appointment credit unwired from Pay Bill. */
  appointmentFeeCredit?: number;
}): Promise<WpayResolvedPayQuote> {
  const config = resolveWpayVendorCommercialConfig(params.vendorRow);
  const engineDiscount = Math.max(0, round2(Number(params.engineDiscountAmount) || 0));

  if (config.commercialModel === 'tier_commission') {
    const settings = await wpayConvenienceSettingsRepository.getConvenienceSettings();
    const quote = computeWpayCommercialQuote({
      quotedAmount: params.quotedAmount,
      commissionPercent: config.commissionPercent,
      discountPercent: 0,
      discountAmountOverride: engineDiscount,
      platformFee: settings.platformFee,
      platformFeeMode: settings.platformFeeMode,
      platformFeeGstRate: settings.platformFeeGstRate,
      convenienceFee: settings.convenienceFee,
      convenienceFeeMode: settings.convenienceFeeMode,
      convenienceGstRate: settings.convenienceGstRate,
      platformGstRate: settings.platformGstRate,
      burnMode: settings.burnMode,
    });

    return {
      commercialModel: 'tier_commission',
      quote,
      payableAmount: quote.payNowAmount,
      metadata: {
        ...buildWpayCommercialSnapshot(quote, {
          tierId: config.tierId,
          tierName: config.tierName,
        }),
        engineDiscountAmount: quote.discountAmount,
        platformFeeMode: settings.platformFeeMode,
        convenienceFeeMode: settings.convenienceFeeMode,
      },
    };
  }

  const quotedAmount = round2(Number(params.quotedAmount));
  const maxDiscount = round2(Math.max(0, quotedAmount - 0.01));
  const discountAmount = round2(Math.min(maxDiscount, engineDiscount));
  const discountPercent =
    quotedAmount > 0 ? round2((discountAmount / quotedAmount) * 100) : 0;
  const payableAmount = Math.max(0.01, round2(quotedAmount - discountAmount));

  const quote: WpayDiscountQuote = {
    originalAmount: quotedAmount,
    appointmentFeeCredit: 0,
    billBase: quotedAmount,
    discountPercent,
    discountAmount,
    payableAmount,
  };

  return {
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
      engineDiscountAmount: quote.discountAmount,
    },
  };
}
