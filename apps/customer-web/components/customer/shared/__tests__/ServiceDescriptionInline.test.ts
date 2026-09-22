import * as fs from 'fs';
import * as path from 'path';

describe('ServiceDescriptionInline full-description dialog', () => {
  it('keeps the vendor description in a scrollable view box', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../ServiceDescriptionInline.tsx'),
      'utf8',
    );
    expect(src).toContain('data-testid="service-description-scroll"');
    expect(src).toContain('overflow-y-scroll');
    expect(src).toContain('overscroll-contain');
    expect(src).toContain("minHeight: 'min(45dvh, 20rem)'");
    expect(src).toContain("maxHeight: 'min(70dvh, 36rem)'");
    expect(src).toContain("margin: 'auto'");
    expect(src).toContain("transform: 'none'");
    expect(src).toContain("height: 'fit-content'");
  });
});
