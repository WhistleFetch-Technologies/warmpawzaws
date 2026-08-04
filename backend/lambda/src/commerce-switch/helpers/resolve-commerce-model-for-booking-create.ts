import { getCommerceResolver } from '../di/commerce-switch-container';
import type { CommerceModelId } from '../contracts/commerce-model';
import type { CommerceResolveContext } from '../contracts/commerce-resolver';

export interface BookingCommerceModelContext extends CommerceResolveContext {
  customerId?: string;
  serviceId?: string;
  serviceType?: string;
}

export interface BookingCommerceModelResult {
  commerceMode: CommerceModelId;
  commerceVersion: number;
}

export async function resolveCommerceModelForBookingCreate(
  context: BookingCommerceModelContext = {}
): Promise<BookingCommerceModelResult> {
  const resolved = await getCommerceResolver().resolveActiveModel(context);
  return {
    commerceMode: resolved.activeModelId,
    commerceVersion: resolved.configurationVersion,
  };
}
