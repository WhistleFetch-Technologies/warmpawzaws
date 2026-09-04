/**
 * @jest-environment node
 */

import * as fs from 'fs';
import * as path from 'path';

describe('WPay catalogue ConfirmDialog visibility', () => {
  it('uses explicit red classes for destructive confirm', () => {
    const src = fs.readFileSync(path.join(__dirname, '../ConfirmDialog.tsx'), 'utf8');
    expect(src).toMatch(/bg-red-600/);
    expect(src).toMatch(/text-white/);
  });
});
