import {
  buildWarmpawzAppointmentsProfileNav,
  isWarmpawzAppointmentsPaymentRequest,
  isWalletDebitAllowedOnPaymentRequest,
  WAPPT_APPOINTMENT_SERVICE_ID,
  WAPPT_VENDOR_PROFILE_SCREEN,
} from '@/lib/warmpawz-appointments-customer';
import { resolveWapptVendorProfileConfig } from '@/lib/warmpawz-appointments/wappt-vendor-profile-config';
import { resolveWapptVendorListConfig } from '@/lib/warmpawz-appointments/wappt-vendor-list-config';
import {
  WAPPT_DISCOVERY_DEFAULT_STYLE,
  WAPPT_DISCOVERY_STYLE_FILTERS,
  resolveWapptDiscoveryInitialStyle,
} from '@/lib/warmpawz-appointments/wappt-list-style-config';

describe('warmpawz appointments profile nav', () => {
  it('builds profile screen payload with defaults', () => {
    const nav = buildWarmpawzAppointmentsProfileNav({
      vendorId: 'vid-1',
      vendorName: 'Paws & Us',
      category: 'vet',
      serviceStyle: 'at_center',
    });
    expect(nav.vendorId).toBe('vid-1');
    expect(nav.profileBackScreen).toBe('wappt-discovery');
  });

  it('exposes stable profile screen id', () => {
    expect(WAPPT_VENDOR_PROFILE_SCREEN).toBe('wappt-vendor-profile');
  });
});

describe('isWarmpawzAppointmentsPaymentRequest', () => {
  it('detects warmpawz appointment payment', () => {
    expect(
      isWarmpawzAppointmentsPaymentRequest({
        bookingMode: 'warmpawz_appointments',
        serviceId: 'x',
      }),
    ).toBe(true);
    expect(
      isWarmpawzAppointmentsPaymentRequest({
        serviceId: 'warmpawz_appointments',
      }),
    ).toBe(true);
    expect(
      isWarmpawzAppointmentsPaymentRequest({
        serviceId: 'regular-service',
      }),
    ).toBe(false);
  });

  it('uses warmpawz_appointments slug that must not be client-resolved to vendor_services UUID', () => {
    expect(WAPPT_APPOINTMENT_SERVICE_ID).toBe('warmpawz_appointments');
    expect(
      isWarmpawzAppointmentsPaymentRequest({
        bookingMode: 'warmpawz_appointments',
        serviceId: WAPPT_APPOINTMENT_SERVICE_ID,
      }),
    ).toBe(true);
  });
});

describe('isWalletDebitAllowedOnPaymentRequest', () => {
  it('hides wallet on Warmpawz Pay appointment-fee checkout', () => {
    expect(
      isWalletDebitAllowedOnPaymentRequest({
        bookingMode: 'warmpawz_appointments',
        serviceId: WAPPT_APPOINTMENT_SERVICE_ID,
      }),
    ).toBe(false);
  });

  it('keeps wallet on marketplace bookings', () => {
    expect(
      isWalletDebitAllowedOnPaymentRequest({
        serviceId: 'regular-service',
      }),
    ).toBe(true);
  });
});

describe('resolveWapptVendorProfileConfig', () => {
  it('uses business-name-friendly vet config', () => {
    const cfg = resolveWapptVendorProfileConfig('vet');
    expect(cfg.servicesApiCategory).toBe('vet');
    expect(cfg.styleBadgeLabel('at_center')).toBe('Clinic Visit');
  });

  it('falls back to vet for unknown categories', () => {
    const cfg = resolveWapptVendorProfileConfig('unknown');
    expect(cfg.category).toBe('vet');
  });
});

describe('resolveWapptVendorListConfig', () => {
  it('uses develop-style vet list shell copy', () => {
    const cfg = resolveWapptVendorListConfig('vet');
    expect(cfg.serviceName).toBe('Veterinary Clinic');
    expect(cfg.serviceSubtitle).toBe('Find a veterinary clinic near you');
    expect(cfg.searchPlaceholder).toBe('Search clinics...');
    expect(cfg.resultsCountLabel(6)).toBe('6 clinics found');
  });

  it('resolves grooming and training list titles', () => {
    expect(resolveWapptVendorListConfig('grooming').serviceName).toBe('Grooming Salon');
    expect(resolveWapptVendorListConfig('training').serviceName).toBe('Training Centre');
  });

  it('uses at_home profile copy for home visit vendor lists', () => {
    const vetHome = resolveWapptVendorListConfig('vet', 'at_home');
    expect(vetHome.serviceName).toBe('Home Visit');
    expect(vetHome.serviceSubtitle).toBe('Vet comes to you');
    expect(vetHome.searchPlaceholder).toBe('Search by name, specialization, city...');
    expect(vetHome.cardCategoryLabel).toBe('Home Visit');

    const groomingHome = resolveWapptVendorListConfig('grooming', 'at_home');
    expect(groomingHome.serviceName).toBe('At Home Grooming');
    expect(groomingHome.serviceSubtitle).toBe('Professional groomer comes to you');
  });
});

describe('WAPPT discovery list style filters', () => {
  it('exposes only at centre and at home toggles', () => {
    expect(WAPPT_DISCOVERY_STYLE_FILTERS.map((f) => f.id)).toEqual(['at_center', 'at_home']);
    expect(WAPPT_DISCOVERY_DEFAULT_STYLE).toBe('at_center');
  });
});

describe('resolveWapptDiscoveryInitialStyle', () => {
  it('clamps stale at_center to at_home for walker', () => {
    expect(resolveWapptDiscoveryInitialStyle('walker', 'at_center')).toBe('at_home');
    expect(resolveWapptDiscoveryInitialStyle('walker', 'at_home')).toBe('at_home');
  });

  it('keeps at_center for vet when allowed', () => {
    expect(resolveWapptDiscoveryInitialStyle('vet', 'at_center')).toBe('at_center');
  });
});
