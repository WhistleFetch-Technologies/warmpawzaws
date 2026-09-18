import { mapAdminDraftToPayload } from '../crud.service';

describe('mapAdminDraftToPayload', () => {
  it('persists datetime-local as Asia/Kolkata and normalizes service slugs', () => {
    const payload = mapAdminDraftToPayload({
      basics: {
        name: 'Vet first visit',
        startAt: '2026-09-17T17:29',
        endAt: '2026-09-30T23:59',
        serviceCategories: ['VET', 'shop'],
      },
    });
    expect(payload.start_at).toBe('2026-09-17T17:29:00+05:30');
    expect(payload.end_at).toBe('2026-09-30T23:59:00+05:30');
    expect(payload.service_categories).toEqual(['veterinary', 'ecommerce']);
  });
});
