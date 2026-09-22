import * as fs from 'fs';
import * as path from 'path';

describe('WAPPT vendor profile services', () => {
  it('loads the full vendor catalog instead of the slim 5-card DTO', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../hooks/useWarmpawzAppointmentsVendorProfile.ts'),
      'utf8',
    );
    expect(src).toContain('buildVendorProfileServicesUrl');
    expect(src).not.toMatch(/buildVendorServicesPageUrl\(/);
  });
});
