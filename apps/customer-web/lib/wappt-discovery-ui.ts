import { isWarmpawzPay } from '@/lib/commerce-switch-client';

/** Hide marketplace pricing on WAPPT discovery rows (card display only — routing uses isWarmpawzAppointmentsHubEnabled). */
export function shouldHideDiscoveryPricing(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  if (!isWarmpawzPay()) return false;
  if (row.warmpawzAppointments === true || row.appointmentsMode === true) return true;
  const style = String(
    row.serviceStyle ?? row.service_style ?? row.serviceType ?? row.service_type ?? '',
  ).toLowerCase();
  if (style === 'tele') return false;
  return true;
}
