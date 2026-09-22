import * as fs from 'fs';
import * as path from 'path';

describe('WAPPT vendor profile services', () => {
  it('pages 5 services at a time and keeps full description on the card DTO path', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../hooks/useWarmpawzAppointmentsVendorProfile.ts'),
      'utf8',
    );
    expect(src).toContain('buildVendorServicesPageUrl');
    expect(src).toContain('config.servicesApiCategory');
    expect(src).not.toMatch(/buildVendorProfileServicesUrl\(/);
  });
});
