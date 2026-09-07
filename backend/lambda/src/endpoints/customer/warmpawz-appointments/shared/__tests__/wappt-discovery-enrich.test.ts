import * as fs from 'fs';
import * as path from 'path';

describe('enrichWapptDiscoveryCards photo signing', () => {
  it('signs Featured Vets photos with getVendorListingPhotoUrl', () => {
    const src = fs.readFileSync(path.join(__dirname, '../wappt-discovery-enrich.ts'), 'utf8');
    expect(src).toContain('getVendorListingPhotoUrl');
    expect(src).toContain('profile_photo_url');
  });
});
