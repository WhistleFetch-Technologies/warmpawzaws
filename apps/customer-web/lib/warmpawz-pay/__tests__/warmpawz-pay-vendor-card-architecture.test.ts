import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const FORBIDDEN_IN_CARD = [
  'useRouter',
  'next/navigation',
  'apiClient',
  'launchWarmpawzPayServiceBooking',
  'router.push',
  'fetch(',
  'wpay-api',
  'runWpayRazorpayCheckout',
];

const FORBIDDEN_IN_MAPPERS = [
  'useRouter',
  'next/navigation',
  'apiClient',
  'router.push',
  'fetch(',
  'launchWarmpawzPayServiceBooking',
];

describe('WarmpawzPayVendorCard architecture guardrails', () => {
  it('keeps business logic out of the presentational card', () => {
    const source = readSource('components/warmpawz-pay/vendor-card/WarmpawzPayVendorCard.tsx');

    for (const token of FORBIDDEN_IN_CARD) {
      expect(source).not.toContain(token);
    }
  });

  it('keeps mappers pure (no routing, APIs, or payment imports)', () => {
    const mapperPaths = [
      'lib/warmpawz-pay/map-discovery-provider-to-vendor-card-props.ts',
      'lib/warmpawz-pay/map-wpay-vendor-card-to-props.ts',
      'lib/warmpawz-pay/wpay-vendor-card-map-utils.ts',
      'lib/warmpawz-pay/discovery-provider-meta-items.ts',
    ];

    for (const mapperPath of mapperPaths) {
      const source = readSource(mapperPath);
      for (const token of FORBIDDEN_IN_MAPPERS) {
        expect(source).not.toContain(token);
      }
    }
  });

  it('documents parent-owned labels and callbacks in discovery mapper signature', () => {
    const source = readSource('lib/warmpawz-pay/map-discovery-provider-to-vendor-card-props.ts');

    expect(source).toContain('primaryLabel');
    expect(source).toContain('onPrimary');
    expect(source).toContain('secondaryLabel');
    expect(source).toContain('onSecondary');
    expect(source).toContain("variant: 'rich'");
    expect(source).toContain('onProfileClick');
  });
});
