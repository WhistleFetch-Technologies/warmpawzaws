import { rejectVendorServicePriceChangeIfLocked } from '../vendor-service-pricing-lock';
import { isWarmpawzPayPricingLocked } from '../../../../commerce-switch/helpers/is-warmpawz-pay-pricing-locked';

jest.mock('../../../../commerce-switch/helpers/is-warmpawz-pay-pricing-locked', () => {
  const actual = jest.requireActual('../../../../commerce-switch/helpers/is-warmpawz-pay-pricing-locked');
  return {
    ...actual,
    isWarmpawzPayPricingLocked: jest.fn(),
  };
});

const mockedLocked = isWarmpawzPayPricingLocked as jest.MockedFunction<typeof isWarmpawzPayPricingLocked>;

describe('rejectVendorServicePriceChangeIfLocked package exception', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLocked.mockImplementation(async (_style, opts) => !opts?.isPackage);
  });

  it('allows package price updates under Pay', async () => {
    const result = await rejectVendorServicePriceChangeIfLocked(
      'at_home',
      { customPrice: 10000, isPackage: true },
    );
    expect(result).toBeNull();
  });

  it('blocks normal service price updates under Pay', async () => {
    const result = await rejectVendorServicePriceChangeIfLocked('at_home', { customPrice: 500 });
    expect(result?.code).toBe('PRICING_LOCKED');
  });

  it('allows package price when existing row is a package', async () => {
    const result = await rejectVendorServicePriceChangeIfLocked(
      'at_center',
      { customPrice: 8000 },
      { metadata: { isPackage: true } },
    );
    expect(result).toBeNull();
  });
});
