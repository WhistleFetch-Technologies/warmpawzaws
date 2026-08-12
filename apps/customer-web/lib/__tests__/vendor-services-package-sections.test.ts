import { discoveryServiceSections, partitionVendorServicesForDiscovery } from '../vendor-services-package-sections';

describe('vendor-services-package-sections', () => {
  it('partitions packages ahead of one-off services', () => {
    const rows = [
      { id: '1', name: 'Consult', isPackage: false },
      { id: '2', name: 'Bundle', isPackage: true, packageDetails: { totalSessions: 5 } },
      { id: '3', name: 'Lab', metadata: { isPackage: true } },
    ] as Record<string, unknown>[];

    const parts = partitionVendorServicesForDiscovery(rows);
    expect(parts.packages.map((r) => r.id)).toEqual(['2', '3']);
    expect(parts.services.map((r) => r.id)).toEqual(['1']);

    const sections = discoveryServiceSections(rows);
    expect(sections.map((s) => s.title)).toEqual(['Packages', 'Available Services']);
    expect(sections[0]!.list).toHaveLength(2);
    expect(sections[1]!.list).toHaveLength(1);
  });
});
