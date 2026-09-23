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

  const quote = computeWpayDiscountQuote(params.quotedAmount, { engineDiscount });
  const metadata = {
    commercialModel: 'withhold' as const,
    quotedOriginalAmount: quote.originalAmount,
    quotedDiscountAmount: quote.discountAmount,
    quotedDiscountPercent: quote.discountPercent,
    billBase: quote.billBase,
    appointmentFeeCredit: 0,
    platformWithholdPercent: config.platformWithholdPercent,
  };
  return {
    commercialModel: 'withhold',
    quote,
    payableAmount: quote.payableAmount,
    metadata,
  };
}
