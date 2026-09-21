import { validateVcfAudience, validateVcfBenefits } from '../promo-engine/vcf';
import { createEmptyVcf } from '../promo-engine/types';

describe('validateVcfAudience', () => {
  it('accepts platform visit source and publish', () => {
    expect(validateVcfAudience(createEmptyVcf())).toEqual([]);
  });
  it('requires a vendor id for V and a category id for C', () => {
    const v = createEmptyVcf();
    v.visitSource.letter = 'V';
    expect(validateVcfAudience(v)).toContain('Visit source: pick a vendor');
    v.visitSource.letter = 'C';
    expect(validateVcfAudience(v)).toContain('Visit source: pick a category');
  });
  it('requires a channel when width is specific', () => {
    const v = createEmptyVcf();
    v.visitSource.width = 'specific';
    v.visitSource.channels = [];
    expect(validateVcfAudience(v)[0]).toMatch(/at least one/);
  });
});

describe('validateVcfBenefits', () => {
  it('requires max discount when both are on', () => {
    const v = createEmptyVcf();
    v.benefitMode = 'both';
    expect(validateVcfBenefits(v, true, true)).toContain(
      'Both requires a max discount greater than 0'
    );
  });
});
