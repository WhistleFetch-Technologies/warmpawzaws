const WAPPT_BOOKING_MODE = 'warmpawz_appointments';

/** Map raw booking row from appointment list/detail SQL to customer-facing appointment payload. */
export function mapAppointmentRowForCustomer(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const commerceMode = String(row.commerce_mode ?? row.commerceMode ?? 'marketplace').trim();
  const bookingServiceName = String(row.booking_service_name ?? '').trim();
  const joinedServiceName = String(row.joined_service_name ?? '').trim();
  const serviceStyle = row.service_style ?? row.serviceStyle;
  const serviceType = row.service_type ?? row.serviceType;

  const catalogName =
    bookingServiceName ||
    joinedServiceName ||
    String(row.service_name ?? row.serviceName ?? 'Service').trim() ||
    'Service';

  const isWappt = commerceMode === WAPPT_BOOKING_MODE;
  const serviceName = isWappt ? bookingServiceName || 'Appointment' : catalogName;

  return {
    ...row,
    service_name: serviceName,
    serviceName,
    commerce_mode: commerceMode,
    commerceMode,
    service_style: serviceStyle,
    serviceStyle,
    service_type: serviceType,
    serviceType,
  };
}
