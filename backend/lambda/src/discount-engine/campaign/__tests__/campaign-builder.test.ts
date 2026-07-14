import { DiscountFunding } from '../../enums/discount-funding';
import { campaignBuilder } from '../campaign-builder';
import { getCampaignTemplate } from '../campaign-template';

describe('campaign-builder', () => {
  it('builds draft from template without pricing fields', () => {
    const built = campaignBuilder.fromTemplate('flash_sale', { name: 'Weekend Flash' });
    expect(built.record.name).toBe('Weekend Flash');
    expect(built.record.campaignType).toBe('flash_sale');
    expect(built.record.status).toBe('draft');
    expect(built.record.funding.type).toBe(DiscountFunding.PLATFORM);
    expect(built.record.discountDomain).toBe('SERVICE');
    expect(built.record.surface).toBe('marketing');
    expect(built.record).not.toHaveProperty('discount_value');
  });

  it('stamps ECOMMERCE domain from surface', () => {
    const built = campaignBuilder.fromInput({
      name: 'Shop Sale',
      campaignType: 'flash_sale',
      surface: 'ecommerce',
      discountDomain: 'ECOMMERCE',
    });
    expect(built.record.discountDomain).toBe('ECOMMERCE');
    expect(built.record.surface).toBe('ecommerce');
  });

  it('uses custom campaign type for unknown types', () => {
    const built = campaignBuilder.fromInput({
      name: 'Custom',
      campaignType: 'unknown_type_xyz',
    });
    expect(built.record.campaignType).toBe('custom');
  });

  it('loads all registered templates', () => {
    expect(getCampaignTemplate('black_friday')?.name).toBe('Black Friday');
    expect(getCampaignTemplate('pet_health_week')?.defaultFunding.type).toBe(DiscountFunding.SHARED);
  });
});
