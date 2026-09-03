import { readFileSync } from 'fs';
import { join } from 'path';

describe('package GST source', () => {
  it('uses category taxCalculationService and not Pay Bill wpay GST settings', () => {
    const src = readFileSync(join(__dirname, '..', 'package-pricing.ts'), 'utf8');
    expect(src).toContain('taxCalculationService');
    expect(src).toContain('calculate-authoritative-service-gst');
    expect(src).not.toMatch(/wpay_platform_gst|wpay_convenience_gst|admin_settings/);
  });
});
