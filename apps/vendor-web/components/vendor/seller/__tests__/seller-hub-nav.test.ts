import * as fs from 'fs';
import * as path from 'path';

describe('Seller Hub navigation', () => {
  it('does not include Promotions or Campaigns', () => {
    const src = fs.readFileSync(path.join(__dirname, '../SellerHub.tsx'), 'utf8');
    expect(src).toMatch(/id: 'products'/);
    expect(src).toMatch(/id: 'settings'/);
    expect(src).not.toMatch(/id: 'promotions'/);
    expect(src).not.toMatch(/id: 'campaigns'/);
    expect(src).not.toContain('PromotionsManagement');
    expect(src).not.toContain('VendorCommercialCampaigns');
  });
});
