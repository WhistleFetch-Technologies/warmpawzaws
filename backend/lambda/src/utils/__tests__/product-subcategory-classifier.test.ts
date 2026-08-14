import {
  ruleMatchesProduct,
  type CategoryRuleRow,
} from '../product-subcategory-classifier';

describe('ruleMatchesProduct (multi-match)', () => {
  const therapeutic: CategoryRuleRow = {
    subcategory_id: 'ther-id',
    include_keywords: ['urinary', 'renal', 'hypoallergenic'],
    exclude_keywords: ['cat litter', 'toy'],
    brand_includes: [],
  };

  const dry: CategoryRuleRow = {
    subcategory_id: 'dry-id',
    include_keywords: ['dry', 'kibble'],
    exclude_keywords: ['cat litter'],
    brand_includes: [],
  };

  const puppy: CategoryRuleRow = {
    subcategory_id: 'puppy-id',
    include_keywords: ['puppy', 'junior'],
    exclude_keywords: [],
    brand_includes: [],
  };

  it('matches multiple independent rules', () => {
    const name = 'Royal Canin Urinary Puppy Dry Food';
    expect(ruleMatchesProduct(therapeutic, name, '', '')).toBe(true);
    expect(ruleMatchesProduct(dry, name, '', '')).toBe(true);
    expect(ruleMatchesProduct(puppy, name, '', '')).toBe(true);
  });

  it('applies exclude keywords', () => {
    expect(ruleMatchesProduct(therapeutic, 'Urinary cat litter', '', '')).toBe(false);
  });

  it('matches brand_includes', () => {
    const rule: CategoryRuleRow = {
      subcategory_id: 'x',
      include_keywords: [],
      exclude_keywords: [],
      brand_includes: ["hill's", 'prescription diet'],
    };
    expect(ruleMatchesProduct(rule, 'Dog Food', '', "Hill's Science")).toBe(true);
    expect(ruleMatchesProduct(rule, 'Dog Food', '', 'Generic')).toBe(false);
  });
});
