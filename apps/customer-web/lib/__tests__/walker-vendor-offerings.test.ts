import {
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
