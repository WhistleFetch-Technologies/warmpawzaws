import { soloPackageCreateBlockReason } from '../solo-vendor-package-access';

describe('soloPackageCreateBlockReason', () => {
  it('allows every solo role to create packages', () => {
    for (const role of ['vet_solo', 'veterinarian', 'nutritionist', 'nutritionist_center', 'groomer', 'walker', 'trainer', '']) {
      expect(soloPackageCreateBlockReason(role, 'session')).toBeNull();
      expect(soloPackageCreateBlockReason(role, 'combo')).toBeNull();
    }
  });
});
