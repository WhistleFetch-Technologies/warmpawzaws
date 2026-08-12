import {
  isWalkerVendorServicePackageRow,
  mapWalkerApiRowToOption,
  rowQualifiesForWalkingModal,
  servicePackageQualifiesForWalkingModal,
} from '../walker-vendor-offerings';

describe('rowQualifiesForWalkingModal', () => {
  it('rejects vet at_home clinical services', () => {
    expect(
      rowQualifiesForWalkingModal({
        name: 'Endocrine Disorders',
        category: 'Veterinary',
        serviceStyle: 'at_home',
      })
    ).toBe(false);
    expect(
      rowQualifiesForWalkingModal({
        name: 'Vet IV Fluid',
        category: 'vet',
        service_style: 'at_home',
      })
    ).toBe(false);
  });

  it('rejects boarding even when category substring contains walk', () => {
    expect(
      rowQualifiesForWalkingModal({
        name: 'boarding',
        category: 'boarding',
        serviceStyle: 'at_home',
      })
    ).toBe(false);
  });

  it('accepts dog walker package with Walking category', () => {
    expect(
      rowQualifiesForWalkingModal({
        name: 'Weekly Walk Bundle',
        category: 'Walking',
        serviceStyle: 'at_home',
        isPackage: true,
        metadata: { isPackage: true },
      })
    ).toBe(true);
    expect(
      rowQualifiesForWalkingModal({
        name: 'Dog Walker Package',
        category: 'Dog Walker',
        service_style: 'outdoor',
      })
    ).toBe(true);
  });

  it('accepts name-based walk services without relying on service style alone', () => {
    expect(
      rowQualifiesForWalkingModal({
        name: 'Morning Dog Walk',
        category: 'General',
        serviceStyle: 'at_home',
      })
    ).toBe(true);
  });

  it('rejects outdoor style without walk category or name', () => {
    expect(
      rowQualifiesForWalkingModal({
        name: 'Endocrine Disorders',
        category: 'General',
        serviceStyle: 'outdoor',
      })
    ).toBe(false);
  });
});

describe('servicePackageQualifiesForWalkingModal', () => {
  it('maps legacy service_packages fields', () => {
    expect(
      servicePackageQualifiesForWalkingModal({
        package_name: '10 Walk Sessions',
        category: 'Walking',
      })
    ).toBe(true);
    expect(
      servicePackageQualifiesForWalkingModal({
        packageName: 'Boarding bundle',
        category: 'boarding',
      })
    ).toBe(false);
  });
});

describe('walker package detection parity', () => {
  it('detects packages when metadata is a JSON string with packageDetails', () => {
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Puppy Walk Pack',
      category: 'Dog Walker',
      metadata: JSON.stringify({
        isPackage: true,
        packageType: 'session',
        packageDetails: { price: 3850, totalSessions: 10 },
      }),
    };
    expect(isWalkerVendorServicePackageRow(row)).toBe(true);
    const opt = mapWalkerApiRowToOption(row, 'at_home');
    expect(opt.isPackage).toBe(true);
    expect(opt.totalSessions).toBe(10);
  });

  it('detects packages from packageDetails alone (no top-level isPackage)', () => {
    const row = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Weekly Walks',
      packageDetails: { totalSessions: 7, price: 2100 },
    };
    expect(isWalkerVendorServicePackageRow(row)).toBe(true);
    expect(mapWalkerApiRowToOption(row, 'at_home').isPackage).toBe(true);
  });
});
