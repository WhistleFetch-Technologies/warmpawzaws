/** Vendor meal order card: "Koramangala 5th Block · 8.2 km" */
export function formatVendorMealDeliveryLocationLine(order: Record<string, unknown>): string | null {
  const areaRaw = order.delivery_area_label ?? order.deliveryAreaLabel;
  const area = typeof areaRaw === 'string' ? areaRaw.trim() : '';
  if (!area) return null;

  const kmRaw = order.delivery_distance_km ?? order.deliveryDistanceKm;
  const km = typeof kmRaw === 'number' ? kmRaw : parseFloat(String(kmRaw ?? ''));
  if (Number.isFinite(km) && km >= 0) {
    const rounded = Math.round(km * 10) / 10;
    const kmText = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${area} · ${kmText} km`;
  }

  return area;
}
