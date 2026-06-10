import { resolveNotificationDeepLink } from '../notification-deep-links';

describe('resolveNotificationDeepLink', () => {
  it('returns video deep link for tele reminder with booking id', () => {
    expect(
      resolveNotificationDeepLink({
        eventType: 'video_call_reminder_5min',
        recipientType: 'customer',
        bookingId: 'abc-123',
      })
    ).toBe('/video?bookingId=abc-123');
  });

  it('returns vendor video route for tele incoming', () => {
    expect(
      resolveNotificationDeepLink({
        eventType: 'tele_call_incoming',
        recipientType: 'vendor',
        bookingId: 'abc-123',
      })
    ).toBe('/video/abc-123');
  });

  it('returns booking routes for lifecycle events', () => {
    expect(
      resolveNotificationDeepLink({
        eventType: 'booking_confirmed',
        recipientType: 'customer',
      })
    ).toBe('/my-bookings');

    expect(
      resolveNotificationDeepLink({
        eventType: 'new_booking',
        recipientType: 'vendor',
      })
    ).toBe('/bookings');
  });

  it('honors explicit override', () => {
    expect(
      resolveNotificationDeepLink({
        eventType: 'campaign',
        recipientType: 'customer',
        deepLinkOverride: '/shop',
      })
    ).toBe('/shop');
  });
});

describe('classifyFcmError', () => {
  it('classifies permanent token errors', async () => {
    const { classifyFcmError } = await import('../firebase-client');
    expect(classifyFcmError('messaging/registration-token-not-registered')).toBe('permanent');
    expect(classifyFcmError(undefined, 'Requested entity was not found')).toBe('permanent');
  });

  it('classifies transient errors', async () => {
    const { classifyFcmError } = await import('../firebase-client');
    expect(classifyFcmError('messaging/server-unavailable')).toBe('transient');
  });
});
