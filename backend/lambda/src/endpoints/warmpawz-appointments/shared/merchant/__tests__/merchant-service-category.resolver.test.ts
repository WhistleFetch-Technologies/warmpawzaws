import {
  expandServiceCategoryFilterTokens,
  launchServiceLabel,
  resolveMerchantServiceCategory,
  resolveRoleLabel,
} from '../merchant-service-category.resolver';

describe('merchant-service-category.resolver', () => {
  it('prefers customer_service over config.category healthcare bucket', () => {
    expect(
      resolveMerchantServiceCategory({
        customerService: 'vet',
        roleCategory: 'healthcare',
        roleDisplayName: 'Vet Clinic',
        roleName: 'vet_clinic',
      }),
    ).toEqual({
      serviceCategoryId: 'vet',
      serviceCategory: 'Vet',
      roleLabel: 'Vet Clinic',
      categoryDisplay: 'Vet · Vet Clinic',
    });
  });

  it('maps behaviorist roles to training launch service', () => {
    expect(
      resolveMerchantServiceCategory({
        customerService: 'training',
        roleDisplayName: 'Behaviorist Center',
        roleName: 'behaviorist_center',
      }),
    ).toEqual({
      serviceCategoryId: 'training',
      serviceCategory: 'Training',
      roleLabel: 'Behaviorist Center',
      categoryDisplay: 'Training · Behaviorist Center',
    });
  });

  it('falls back to formatted role name when display name is missing', () => {
    expect(resolveRoleLabel({ roleName: 'groomer_solo' })).toBe('Groomer Solo');
  });

  it('expands vet filter tokens for SQL matching', () => {
    const tokens = expandServiceCategoryFilterTokens('vet');
    expect(tokens).toContain('vet');
    expect(tokens.some((token) => token.includes('vet'))).toBe(true);
  });

  it('expands walking chip to walker role tokens', () => {
    const tokens = expandServiceCategoryFilterTokens('walking');
    expect(tokens).toContain('walking');
    expect(tokens).toContain('walker');
  });

  it('expands sitting chip to pet sitter role tokens', () => {
    const tokens = expandServiceCategoryFilterTokens('sitting');
    expect(tokens).toContain('sitting');
    expect(tokens.some((t) => t.includes('sitter'))).toBe(true);
  });

  it('expands nutrition chip to nutritionist role tokens', () => {
    const tokens = expandServiceCategoryFilterTokens('nutrition');
    expect(tokens).toContain('nutrition');
    expect(tokens).toContain('nutritionist');
  });

  it('expands behaviorist chip to behaviorist role tokens', () => {
    const tokens = expandServiceCategoryFilterTokens('behaviorist');
    expect(tokens).toContain('behaviorist');
  });

  it('expands boarding chip to boarding role tokens', () => {
    const tokens = expandServiceCategoryFilterTokens('boarding');
    expect(tokens).toContain('boarding');
  });

  it('labels unknown launch ids using title case', () => {
    expect(launchServiceLabel('custom_service')).toBe('Custom Service');
  });
});
