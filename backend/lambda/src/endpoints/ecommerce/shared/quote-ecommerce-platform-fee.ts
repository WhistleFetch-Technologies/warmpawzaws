import { wpayConvenienceSettingsRepository } from '../../warmpawz-pay/repositories/wpay-convenience-settings.repository';
import {
  computeEcommercePlatformFee,
  type EcommercePlatformFeeQuote,
} from '../../../utils/ecommerce/platform-fee';

/** Reads the Pay Bill admin fee settings and prices them for one shop cart. */
export async function quoteEcommercePlatformFee(
  subtotalAfterDiscount: number,
): Promise<EcommercePlatformFeeQuote> {
  const settings = await wpayConvenienceSettingsRepository.getConvenienceSettings();
  return computeEcommercePlatformFee({
    subtotalAfterDiscount,
    platformFee: settings.platformFee,
    platformFeeMode: settings.platformFeeMode,
    platformFeeGstRate: settings.platformFeeGstRate,
  });
}
