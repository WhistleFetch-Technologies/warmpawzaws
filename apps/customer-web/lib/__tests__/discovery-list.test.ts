import { discoveryVendorList } from '../discovery-list';

describe('discoveryVendorList', () => {
  it('prefers vendors over legacy providers twin', () => {
    const rows = discoveryVendorList({
      vendors: [{ id: 'v1' }],
      providers: [{ id: 'p1' }],
    });
    expect(rows).toEqual([{ id: 'v1' }]);
  });

  it('falls back to providers when vendors is absent', () => {
    const rows = discoveryVendorList({
      providers: [{ id: 'p1' }],
    });
    expect(rows).toEqual([{ id: 'p1' }]);
  });

  it('returns empty array for invalid payloads', () => {
    expect(discoveryVendorList(null)).toEqual([]);
    expect(discoveryVendorList({})).toEqual([]);
  });
});
