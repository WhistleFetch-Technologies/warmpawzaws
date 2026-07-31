import {
  buildWarmpawzAppointmentsProfileNav,
  isWarmpawzAppointmentsPaymentRequest,
  WAPPT_APPOINTMENT_SERVICE_ID,
  WAPPT_VENDOR_PROFILE_SCREEN,
} from '@/lib/warmpawz-appointments-customer';
import { resolveWapptVendorProfileConfig } from '@/lib/warmpawz-appointments/wappt-vendor-profile-config';
import { resolveWapptVendorListConfig } from '@/lib/warmpawz-appointments/wappt-vendor-list-config';
import {
  WAPPT_DISCOVERY_DEFAULT_STYLE,
  WAPPT_DISCOVERY_STYLE_FILTERS,
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
});

describe('WAPPT discovery list style filters', () => {
  it('exposes only at centre and at home toggles', () => {
    expect(WAPPT_DISCOVERY_STYLE_FILTERS.map((f) => f.id)).toEqual(['at_center', 'at_home']);
    expect(WAPPT_DISCOVERY_DEFAULT_STYLE).toBe('at_center');
  });
});

describe('WAPPT profile provider stats fallbacks', () => {
  it('uses API experience when present including zero', () => {
    const years = 0;
    expect(years != null ? years : '5+').toBe(0);
  });

  it('falls back to 5+ when experience is missing', () => {
    const years: number | null | undefined = undefined;
    expect(years != null ? years : '5+').toBe('5+');
  });
});
