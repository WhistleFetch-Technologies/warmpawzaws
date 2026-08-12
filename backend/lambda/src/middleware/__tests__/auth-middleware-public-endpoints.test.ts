import { isPublicEndpoint } from '../auth-middleware';

describe('isPublicEndpoint', () => {
  it('allows Allyticas ingest without auth', () => {
    expect(isPublicEndpoint('/analytics/v1/events')).toBe(true);
  });

  it('keeps admin product analytics read APIs protected', () => {
    expect(isPublicEndpoint('/admin/analytics/product/summary')).toBe(false);
    expect(isPublicEndpoint('/admin/analytics/product/events')).toBe(false);
    expect(isPublicEndpoint('/admin/analytics/product/screens')).toBe(false);
  });
});
