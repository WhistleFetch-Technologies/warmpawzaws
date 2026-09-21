import * as fs from 'fs';
import * as path from 'path';

describe('retired vendor UPI APIs', () => {
  it('returns 410 instead of collecting UPI', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../endpoints/vendor/endpoints/vendor-bank-accounts.ts'),
      'utf8',
    );
    expect(src).toContain('410');
    expect(src).toContain('Vendor UPI details have been removed');
    expect(src).not.toContain('validateVpa');
  });
});
