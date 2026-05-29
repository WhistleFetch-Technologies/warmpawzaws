import {
  buildVendorAppointmentScheduledSmsBody,
  formatVendorAppointmentDate,
  formatVendorAppointmentTime,
} from '../../constants/jio-vendor-appointment-sms';
import { parseMealDeliverySlot } from '../vendor-appointment-sms';

describe('formatVendorAppointmentDate', () => {
  it('formats ISO date like approved sample', () => {
    expect(formatVendorAppointmentDate('2026-06-12')).toBe('12 Jun 2026');
  });
});

describe('formatVendorAppointmentTime', () => {
  it('formats 24h time to 12h', () => {
    expect(formatVendorAppointmentTime('16:00:00')).toBe('4:00 PM');
    expect(formatVendorAppointmentTime('09:30')).toBe('9:30 AM');
  });
});

describe('parseMealDeliverySlot', () => {
  it('reads slot start from JSON object', () => {
    expect(parseMealDeliverySlot({ start: '16:00' })).toBe('16:00:00');
    expect(parseMealDeliverySlot({ slot: { start: '10:30' } })).toBe('10:30:00');
  });
});

describe('buildVendorAppointmentScheduledSmsBody', () => {
  it('matches approved Jio DLT template', () => {
    const msg = buildVendorAppointmentScheduledSmsBody({
      vendorName: 'Rahul Sharma',
      bookingDate: '2026-06-12',
      bookingTime: '16:00:00',
    });
    expect(msg).toBe(
      'Warmpawz: Hi Rahul, you have a new appointment on 12 Jun 2026 at 4:00 PM.'
    );
  });

  it('uses fallback name when vendor name missing', () => {
    const msg = buildVendorAppointmentScheduledSmsBody({
      bookingDate: '2026-06-12',
      bookingTime: '16:00:00',
    });
    expect(msg).toBe(
      'Warmpawz: Hi there, you have a new appointment on 12 Jun 2026 at 4:00 PM.'
    );
  });
});
