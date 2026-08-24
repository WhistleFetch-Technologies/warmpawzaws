import {
  resolveMarketplaceDiscoveryOptions,
  resolveWarmpawzCatalogueDiscoveryOptions,
} from '../wappt-catalogue-discovery.service';

describe('catalogue discovery options', () => {
  const prev = process.env.WARMPAWZ_APPOINTMENTS_ENABLED;

  afterEach(() => {
    if (prev === undefined) delete process.env.WARMPAWZ_APPOINTMENTS_ENABLED;
    else process.env.WARMPAWZ_APPOINTMENTS_ENABLED = prev;
  });

  it('does not gate marketplace lists on Appointments catalogue publish', () => {
    process.env.WARMPAWZ_APPOINTMENTS_ENABLED = 'true';
    expect(resolveMarketplaceDiscoveryOptions().wapptCatalogueOnly).toBeFalsy();
  });

  it('keeps Appointments discovery on published catalogue rows', () => {
    process.env.WARMPAWZ_APPOINTMENTS_ENABLED = 'true';
    expect(resolveWarmpawzCatalogueDiscoveryOptions()).toEqual(
      expect.objectContaining({ wapptCatalogueOnly: true }),
    );
  });

  it('returns empty options when Appointments is disabled', () => {
    process.env.WARMPAWZ_APPOINTMENTS_ENABLED = 'false';
    expect(resolveMarketplaceDiscoveryOptions()).toEqual({});
    expect(resolveWarmpawzCatalogueDiscoveryOptions()).toEqual({});
  });
});
