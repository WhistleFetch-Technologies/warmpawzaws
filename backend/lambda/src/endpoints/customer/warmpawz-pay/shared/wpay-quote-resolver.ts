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
  appointmentFeeCredit?: number;
}): Promise<WpayResolvedPayQuote> {
  const config = resolveWpayVendorCommercialConfig(params.vendorRow);
  const credit = params.appointmentFeeCredit ?? 0;

  if (config.commercialModel === 'tier_commission') {
    const settings = await wpayConvenienceSettingsRepository.getConvenienceSettings();
    const quote = computeWpayCommercialQuote({
      quotedAmount: params.quotedAmount,
      commissionPercent: config.commissionPercent,
      discountPercent: config.discountPercent,
      appointmentFeeCredit: credit,
      convenienceFee: settings.convenienceFee,
      convenienceGstRate: settings.convenienceGstRate,
      platformGstRate: settings.platformGstRate,
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

  const quote = computeWpayDiscountQuote(params.quotedAmount, config.discountPercent, {
    appointmentFeeCredit: credit,
  });

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
      appointmentFeeCredit: quote.appointmentFeeCredit,
      platformWithholdPercent: config.platformWithholdPercent,
    },
  };
}
