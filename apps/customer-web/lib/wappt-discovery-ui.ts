/** Hide marketplace pricing on WAPPT discovery rows. */
export function shouldHideDiscoveryPricing(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  return row.warmpawzAppointments === true || row.appointmentsMode === true;
}
