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

  it('allows guest GET of the Google Maps browser key', () => {
    expect(isPublicEndpoint('/config/google-maps-key', 'GET')).toBe(true);
    expect(isPublicEndpoint('/config/google-maps-key')).toBe(true);
  });

  it('keeps PUT of the Google Maps key authenticated', () => {
    expect(isPublicEndpoint('/config/google-maps-key', 'PUT')).toBe(false);
  });

  it('allows guest shop categories and published articles via /public aliases', () => {
    expect(isPublicEndpoint('/public/ecommerce/categories', 'GET')).toBe(true);
    expect(isPublicEndpoint('/public/articles', 'GET')).toBe(true);
    expect(isPublicEndpoint('/public/articles/summer-grooming', 'GET')).toBe(true);
  });

  it('allows guest catalogue reads for shop categories and published articles', () => {
    expect(isPublicEndpoint('/ecommerce/categories', 'GET')).toBe(true);
    expect(isPublicEndpoint('/customer/articles', 'GET')).toBe(true);
    expect(isPublicEndpoint('/customer/articles/summer-grooming', 'GET')).toBe(true);
  });
});
