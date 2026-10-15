import * as fs from 'fs';
import * as path from 'path';

describe('Insurance vendor shell', () => {
  it('keeps the old home and adds the three insurance screens in the sidebar', () => {
    const shell = fs.readFileSync(path.join(__dirname, '../InsuranceVendorShell.tsx'), 'utf8');
    const landing = fs.readFileSync(
      path.join(__dirname, '../../landingPage/VendorLandingPage.tsx'),
      'utf8',
    );
    expect(shell).toMatch(/id: 'home'/);
    expect(shell).toMatch(/id: 'kanban'/);
    expect(shell).toMatch(/id: 'chat'/);
    expect(shell).toMatch(/id: 'forms'/);
    expect(shell).toContain('children');
    expect(landing).toContain('InsuranceVendorShell');
    expect(landing).not.toContain('return <InsuranceWorkspace');
  });
});
