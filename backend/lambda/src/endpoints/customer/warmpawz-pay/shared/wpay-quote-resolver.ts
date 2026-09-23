import { wpayConvenienceSettingsRepository } from '../../../warmpawz-pay/repositories/wpay-convenience-settings.repository';
import type { WpayVendorListDbRow } from '../repos/wpay-vendors-list.repo';
import { resolveWpayVendorCommercialConfig } from './wpay-commercial-config';
import { applyEngineDiscountToWpayPayable } from './apply-engine-discount-to-wpay';
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
  /** Promo-engine ₹ off. Catalogue % stays 0. */
  engineDiscount?: number | null;
  /** @deprecated Ignored — appointment credit unwired from Pay Bill. */
  appointmentFeeCredit?: number;
}): Promise<WpayResolvedPayQuote> {
  const config = resolveWpayVendorCommercialConfig(params.vendorRow);
  const engineDiscount = Math.max(0, Number(params.engineDiscount) || 0);

  if (config.commercialModel === 'tier_commission') {
    const settings = await wpayConvenienceSettingsRepository.getConvenienceSettings();
    const quote = computeWpayCommercialQuote({
      quotedAmount: params.quotedAmount,
      commissionPercent: config.commissionPercent,
      discountPercent: 0,
      engineDiscount,
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
      metadata: buildWpayCommercialSnapshot(quote, {
        tierId: config.tierId,
        tierName: config.tierName,
      }),
    };
  }

  const quote = computeWpayDiscountQuote(params.quotedAmount, 0);
  const metadata = {
    commercialModel: 'withhold' as const,
    quotedOriginalAmount: quote.originalAmount,
    quotedDiscountAmount: quote.discountAmount,
    quotedDiscountPercent: quote.discountPercent,
    billBase: quote.billBase,
    appointmentFeeCredit: 0,
    platformWithholdPercent: config.platformWithholdPercent,
  };
  if (engineDiscount <= 0.009) {
    return {
      commercialModel: 'withhold',
      quote,
      payableAmount: quote.payableAmount,
      metadata,
    };
  }
  const applied = applyEngineDiscountToWpayPayable({
    quotedAmount: params.quotedAmount,
    cataloguePayable: quote.payableAmount,
    engineDiscount,
    metadata,
  });
  return {
    commercialModel: 'withhold',
    quote: {
      ...quote,
      discountAmount: applied.discountAmount,
      discountPercent: params.quotedAmount > 0
        ? Math.round((applied.discountAmount / params.quotedAmount) * 10000) / 100
        : 0,
      payableAmount: applied.payableAmount,
    },
    payableAmount: applied.payableAmount,
    metadata: applied.metadata,
  };
}
