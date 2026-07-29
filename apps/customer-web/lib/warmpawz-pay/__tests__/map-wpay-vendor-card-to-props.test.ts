import { mapWpayVendorCardToProps } from '../map-wpay-vendor-card-to-props';
import type { WpayVendorCard } from '../wpay-api';

describe('mapWpayVendorCardToProps', () => {
  it('maps Pay Hub list DTO to presentation props only', () => {
    const vendor: WpayVendorCard = {
      vendorId: 'vendor-1',
      name: 'Happy Tails Vet',
      photoUrl: 'https://cdn.example/photo.png',
      phone: '+91 98765 43210',
      address: '  Sector 12  ',
      discountPercent: 10,
      category: 'vet',
    };

    const props = mapWpayVendorCardToProps(vendor);

    expect(props).toEqual({
      name: 'Happy Tails Vet',
      imageUrl: 'https://cdn.example/photo.png',
      subtitle: '+91 98765 43210',
      address: 'Sector 12',
      badges: [{ label: '10% OFF', tone: 'discount' }],
    });
    expect(props.primaryAction).toBeUndefined();
    expect(props.secondaryAction).toBeUndefined();
  });

  it('omits badges and address when not applicable', () => {
    const props = mapWpayVendorCardToProps({
      vendorId: 'vendor-2',
      name: 'No Discount Shop',
      phone: null,
      address: '   ',
      photoUrl: null,
      discountPercent: 0,
      category: 'grooming',
    });

    expect(props.badges).toBeUndefined();
    expect(props.address).toBeUndefined();
    expect(props.subtitle).toBeUndefined();
  });
});
