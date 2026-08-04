import { acceptableStylesForService } from '../../repos/legacy-helpers.repo';

export function filterVendorServicesByStyle<T extends { serviceStyle?: string | null; service_style?: string | null }>(
  services: T[],
  serviceStyle?: string | null
): T[] {
  if (!serviceStyle || serviceStyle === 'all') return services;
  const acceptableStyles = acceptableStylesForService(serviceStyle);
  return services.filter((s) => acceptableStyles.includes(s.serviceStyle || s.service_style || ''));
}
