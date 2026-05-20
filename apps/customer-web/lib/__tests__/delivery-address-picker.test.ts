import {
  deliveryAddressTitle,
  formatDeliveryAddressLine,
} from '@/lib/ecommerce/delivery-address-display';
import type { DeliveryAddress } from '@/lib/ecommerce/load-customer-addresses';

describe('delivery address picker helpers', () => {
  const sample: DeliveryAddress = {
    id: 'a1',
    fullName: 'Raj Singh',
    addressLine1: 'Kathriguppe Circle',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560085',
    phone: '8780459376',
  };

  it('formats a full address line', () => {
    expect(formatDeliveryAddressLine(sample)).toBe(
      'Kathriguppe Circle, Bengaluru, Karnataka 560085'
    );
  });

  it('uses profile fallback title', () => {
    expect(deliveryAddressTitle({ id: 'profile', addressLine1: 'Line' })).toBe(
      'Profile address'
    );
  });

  it('prefers label then full name', () => {
    expect(
      deliveryAddressTitle({
        label: 'Home',
        fullName: 'Raj Singh',
      } as DeliveryAddress & { label: string })
    ).toBe('Home');
    expect(deliveryAddressTitle(sample)).toBe('Raj Singh');
  });
});
