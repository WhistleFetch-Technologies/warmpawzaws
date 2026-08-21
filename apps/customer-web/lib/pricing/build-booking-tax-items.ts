/**
 * Builds /tax/calculate items from selected services.
 * Does not compute GST — backend remains authoritative.
 */

export type BookingTaxService = {
  id?: unknown;
  serviceId?: unknown;
  service_id?: unknown;
  name?: unknown;
  serviceName?: unknown;
  category?: unknown;
  originalPrice?: unknown;
  original_price?: unknown;
  price?: unknown;
  custom_price?: unknown;
  quantity?: unknown;
};

function money(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function selectedServiceCustomerAmount(service: BookingTaxService): number {
  const qty = Math.max(1, parseInt(String(service.quantity ?? 1), 10) || 1);
  const list =
    money(service.originalPrice ?? service.original_price) ||
    money(service.price) ||
    money(service.custom_price);
  return money(list * qty);
}

export function allocateTaxableAcrossSelectedServices(
  services: BookingTaxService[],
  postDiscountTotal: number,
): number[] {
  const lists = services.map((service) => selectedServiceCustomerAmount(service));
  const listSum = money(lists.reduce((sum, n) => sum + n, 0));
  const target = Math.max(0, money(postDiscountTotal));
  if (lists.length === 0) return [];
  if (listSum <= 0.009) return lists.map(() => 0);
  if (Math.abs(listSum - target) <= 0.009) return lists;
  const allocated = lists.map((list) => money((list / listSum) * target));
  const allocatedSum = money(allocated.reduce((sum, n) => sum + n, 0));
  allocated[allocated.length - 1] = money(allocated[allocated.length - 1] + (target - allocatedSum));
  return allocated;
}

export function buildBookingTaxCalculateItems(params: {
  selectedServices?: BookingTaxService[] | null;
  fallbackServiceId?: string | null;
  fallbackBookingId?: string | null;
  fallbackAmount: number;
  category?: string | null;
  serviceStyle?: string | null;
  amountTaxInclusive?: boolean;
}): Array<Record<string, unknown>> {
  const selected = (params.selectedServices || []).filter(Boolean);
  const amounts =
    selected.length > 0
      ? allocateTaxableAcrossSelectedServices(selected, params.fallbackAmount)
      : [Math.max(0, money(params.fallbackAmount))];

  if (selected.length > 0) {
    return selected.map((service, index) => {
      const serviceId = String(service.id || service.serviceId || service.service_id || params.fallbackServiceId || '');
      return {
        id: serviceId || `service-${index}`,
        type: 'service',
        serviceId: serviceId || undefined,
        amount: amounts[index],
        quantity: 1,
        category: service.category || params.category || undefined,
        serviceStyle: params.serviceStyle || undefined,
        amountTaxInclusive: params.amountTaxInclusive === true,
      };
    });
  }

  return [
    {
      id: params.fallbackServiceId || params.fallbackBookingId || 'item',
      type: 'service',
      serviceId: params.fallbackServiceId || undefined,
      bookingId: params.fallbackBookingId || undefined,
      amount: amounts[0],
      quantity: 1,
      category: params.category || undefined,
      serviceStyle: params.serviceStyle || undefined,
      amountTaxInclusive: params.amountTaxInclusive === true,
    },
  ];
}
