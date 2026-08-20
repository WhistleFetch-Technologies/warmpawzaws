import type { DeliveryAddress } from '@/lib/ecommerce/load-customer-addresses';

export function formatDeliveryAddressLine(addr: DeliveryAddress): string {
  const line1 = (addr.addressLine1 || addr.street || '').trim();
  const city = (addr.city || '').trim();
  const state = (addr.state || '').trim();
  const pincode = (addr.pincode || '').trim();
  const locality = [city, state].filter(Boolean).join(', ');
  const tail = [locality, pincode].filter(Boolean).join(' ');
  if (line1 && tail) return `${line1}, ${tail}`;
  return line1 || tail || 'Address';
}

export function deliveryAddressTitle(addr: DeliveryAddress): string {
  if (addr.id === 'guest-location') return 'Current location';
  const label = (addr as DeliveryAddress & { label?: string }).label;
  if (label) return label;
  return addr.fullName || addr.name || (addr.id === 'profile' ? 'Profile address' : 'Address');
}

export function deliveryAddressKey(addr: DeliveryAddress, index: number): string {
  return addr.id ?? `addr-${index}`;
}
