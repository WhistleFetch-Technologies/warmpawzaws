/**
 * @jest-environment node
 */

import * as fs from 'fs';
import * as path from 'path';

describe('warmpawz-pay layout PAY BILL nav', () => {
  it('navigates to published vendors from nested WPay routes', () => {
    const src = fs.readFileSync(path.join(__dirname, '../layout.tsx'), 'utf8');
    expect(src).toMatch(/usePathname/);
    expect(src).toMatch(/router\.push\(WPAY_VENDORS_PATH\)/);
    expect(src).not.toMatch(/if \(screen === 'warmpawz-pay'\) return;/);
  });
});
