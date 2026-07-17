import { execSync } from 'child_process';
import path from 'path';

describe('customer endpoint layer compliance', () => {
  it('passes validate-customer-layers.js with zero violations', () => {
    const script = path.join(__dirname, '../../../../scripts/validate-customer-layers.js');
    const out = execSync(`node "${script}"`, { encoding: 'utf8' });
    expect(out).toContain('Layer compliance OK');
  });
});
