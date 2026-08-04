import {
  isWarmpawzPayActive,
  isWarmpawzPayPricingLocked,
  isPricingLockedServiceStyle,
  pricingLockMetaForStyle,
  rejectVendorServicePriceChangeIfLocked,
  stripVendorServicePriceFields,
} from '../../../commerce-switch/helpers/is-warmpawz-pay-pricing-locked';

export {
  isWarmpawzPayActive,
  isWarmpawzPayPricingLocked,
  isPricingLockedServiceStyle,
  stripVendorServicePriceFields,
  vendorServicePayloadHasPriceChange,
};

export async function pricingLockMetaForStyle(serviceStyle: string | null | undefined) {
  const pricingLocked = await isWarmpawzPayPricingLocked(serviceStyle);
  return pricingLocked
    ? { pricingLocked: true as const, pricingLockReason: 'warmpawz_pay' as const }
    : { pricingLocked: false as const };
}

export async function stripVendorServiceRowPricesIfLocked<T extends Record<string, unknown>>(
  row: T,
  serviceStyle: string | null | undefined,
): Promise<T> {
  if (!(await isWarmpawzPayPricingLocked(serviceStyle))) return row;
  return stripVendorServicePriceFields(row);
}

export async function rejectVendorServicePriceChangeIfLocked(
  serviceStyle: string | null | undefined,
  body: Record<string, unknown>,
): Promise<{ error: string; code: string } | null> {
  if (!vendorServicePayloadHasPriceChange(body)) return null;
  if (!(await isWarmpawzPayPricingLocked(serviceStyle))) return null;
  return {
    error:
      'Price cannot be changed for at_home/at_center services while Warmpawz Pay + Appointments is active. Contact platform admin for appointment fees.',
    code: 'PRICING_LOCKED',
  };
}
