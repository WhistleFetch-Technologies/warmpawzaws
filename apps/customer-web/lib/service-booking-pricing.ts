/**
 * Server-side booking price quote (promotions auto-applied).
 */
import { apiClient } from '@/lib/api-client';

export type ServiceBookingQuote = {
  basePrice: number;
  discount: number;
  tax: number;
  finalPrice: number;
  taxBreakdown?: Array<{ name: string; rate: number; amount: number }>;
  appliedPromotions?: Array<{
    id: string;
    type: string;
    name: string;
    discountAmount: number;
  }>;
  vendorPromotionId?: string;
  platformPromotionId?: string;
};

export async function fetchServiceBookingQuote(params: {
  serviceId: string;
  vendorId: string;
  customerId?: string;
  serviceStyle?: string;
  customerState?: string;
  customerCity?: string;
}): Promise<ServiceBookingQuote | null> {
  try {
    const res = await apiClient.post<ServiceBookingQuote & { success?: boolean }>(
      '/customer/pricing/quote',
      {
        serviceId: params.serviceId,
        vendorId: params.vendorId,
        customerId: params.customerId,
        serviceStyle: params.serviceStyle,
        customerState: params.customerState,
        customerCity: params.customerCity,
      }
    );
    if ((res as { success?: boolean }).success === false) return null;
    return res as ServiceBookingQuote;
  } catch {
    return null;
  }
}

export async function fetchBookingPromotionStack(params: {
  vendorId: string;
  serviceIds: string[];
  amount: number;
  customerId?: string;
  serviceStyle?: string;
  serviceCategory?: string;
}) {
  try {
    return await apiClient.post<{
      success?: boolean;
      totalSavings?: number;
      finalAmount?: number;
      vendorPromotionId?: string;
      platformPromotionId?: string;
      vendorDiscountAmount?: number;
      platformDiscountAmount?: number;
      applied?: Array<{ source: string; id: string; name: string; discountAmount: number }>;
    }>('/promotions/calculate-booking', params);
  } catch {
    return null;
  }
}
