import {
  applyWapptCatalogueFeeAmounts,
  isWarmpawzAppointmentsBooking,
  resolveWarmpawzAppointmentsBookingPreflight,
  WAPPT_BOOKING_MODE,
  WAPPT_CATALOG_SERVICE_SENTINEL_ID,
  WAPPT_DISPLAY_SERVICE_NAME,
  WAPPT_SERVICE_SLUG,
  wapptStyleAliases,
} from '../wappt-booking-preflight';

jest.mock('../../../../database/rds-connection', () => ({
  query: jest.fn(),
}));

import { query } from '../../../../database/rds-connection';

const mockedQuery = query as jest.MockedFunction<typeof query>;

describe('wappt-booking-preflight', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('exposes stable slug and display label', () => {
    expect(WAPPT_SERVICE_SLUG).toBe('warmpawz_appointments');
    expect(WAPPT_BOOKING_MODE).toBe('warmpawz_appointments');
    expect(WAPPT_DISPLAY_SERVICE_NAME).toBe('Appointment');
    expect(WAPPT_CATALOG_SERVICE_SENTINEL_ID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('detects WAPPT booking from bookingMode or serviceId slug', () => {
    expect(
      isWarmpawzAppointmentsBooking({
        bookingMode: WAPPT_BOOKING_MODE,
        serviceId: 'any',
      }),
    ).toBe(true);
    expect(
      isWarmpawzAppointmentsBooking({
        serviceId: WAPPT_SERVICE_SLUG,
      }),
    ).toBe(true);
    expect(
      isWarmpawzAppointmentsBooking({
        serviceId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).toBe(false);
  });

  it('locks catalogue fee and zeros GST so marketplace list price cannot win', () => {
    expect(applyWapptCatalogueFeeAmounts(99)).toEqual({
      basePrice: 99,
      totalAmount: 99,
      taxAmount: 0,
    });
    expect(applyWapptCatalogueFeeAmounts(99).totalAmount).not.toBe(
      Math.max(99, 1299),
    );
  });

  it('maps at_center aliases used by grooming/boarding', () => {
    expect(wapptStyleAliases('at_center').acceptableStyles).toEqual(
      expect.arrayContaining(['at_center', 'at_clinic', 'boarding']),
    );
    expect(wapptStyleAliases('at_home').acceptableStyles).toEqual(
      expect.arrayContaining(['at_home', 'home_visit']),
    );
  });

  it('uses any published service when style does not match', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ appointment_fee: '99' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ vendor_service_id: 'vs-any-style' }] } as never);

    const result = await resolveWarmpawzAppointmentsBookingPreflight({
      vendorId: '11111111-1111-4111-8111-111111111111',
      serviceStyle: 'at_center',
    });

    expect(result).toEqual({
      ok: true,
      appointmentFee: 99,
      resolvedServiceId: 'vs-any-style',
    });
  });

  it('creates a stub vendor service when the vendor has none', async () => {
    mockedQuery.mockImplementation((async (sql: string) => {
      if (sql.includes('appointment_fee')) {
        return { rows: [{ appointment_fee: '99' }] };
      }
      if (sql.includes('FROM vendor_services') && sql.includes('service_id = $2')) {
        return { rows: [{ vendor_service_id: 'vs-stub' }] };
      }
      return { rows: [] };
    }) as never);

    const result = await resolveWarmpawzAppointmentsBookingPreflight({
      vendorId: '11111111-1111-4111-8111-111111111111',
      serviceStyle: 'at_home',
    });

    expect(result).toEqual({
      ok: true,
      appointmentFee: 99,
      resolvedServiceId: 'vs-stub',
    });
  });
});
