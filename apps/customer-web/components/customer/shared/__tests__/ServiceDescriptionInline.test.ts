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
    expect(src).toContain('min-h-0');
    expect(src).toContain('flex-1');
    expect(src).toContain('overscroll-contain');
    expect(src).toContain("maxHeight: 'min(70dvh, 28rem)'");
    expect(src).toContain("margin: 'auto'");
    expect(src).toContain("transform: 'none'");
    expect(src).toContain("height: 'fit-content'");
  });
});
