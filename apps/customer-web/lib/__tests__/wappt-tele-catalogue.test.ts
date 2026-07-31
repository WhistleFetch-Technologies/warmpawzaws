import { resolveTeleConsultShellNavigation } from '@/lib/warmpawz-appointments/wappt-tele-catalogue';
import { isWarmpawzTeleCatalogueEnabled } from '@/lib/warmpawz-appointments-customer';

jest.mock('@/lib/warmpawz-appointments-customer', () => ({
  isWarmpawzTeleCatalogueEnabled: jest.fn(),
}));

const mockTeleCatalogueEnabled = isWarmpawzTeleCatalogueEnabled as jest.Mock;

describe('resolveTeleConsultShellNavigation', () => {
  beforeEach(() => {
    mockTeleCatalogueEnabled.mockReset();
  });

  it('routes to wappt tele discovery when Warmpawz Pay catalogue is enabled', () => {
    mockTeleCatalogueEnabled.mockReturnValue(true);
    expect(resolveTeleConsultShellNavigation()).toEqual({
      screen: 'wappt-discovery',
      data: { category: 'vet', serviceStyle: 'tele', lockStyleFilter: true },
    });
  });

  it('falls back to legacy tele router when catalogue is disabled', () => {
    mockTeleCatalogueEnabled.mockReturnValue(false);
    expect(resolveTeleConsultShellNavigation()).toEqual({
      screen: 'vet-tele-consultation',
      data: { startStep: 'scheduled' },
    });
  });
});
