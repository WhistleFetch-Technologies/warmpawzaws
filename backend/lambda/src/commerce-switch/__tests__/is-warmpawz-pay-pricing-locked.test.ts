import {
  isPricingLockedServiceStyle,
  isWarmpawzPayActive,
  isWarmpawzPayPricingLocked,
  normalizeServiceStyleForPricingLock,
  stripVendorServicePriceFields,
  vendorServicePayloadHasPriceChange,
} from '../helpers/is-warmpawz-pay-pricing-locked';
import { getCommerceResolver } from '../di/commerce-switch-container';

jest.mock('../di/commerce-switch-container', () => ({
  getCommerceResolver: jest.fn(),
}));

const mockedGetResolver = getCommerceResolver as jest.MockedFunction<typeof getCommerceResolver>;

function mockActiveModel(activeModelId: 'marketplace' | 'warmpawz_pay') {
  mockedGetResolver.mockReturnValue({
    resolveActiveModel: jest.fn().mockResolvedValue({
      activeModelId,
      configurationVersion: 1,
    }),
  } as any);
}

describe('is-warmpawz-pay-pricing-locked', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes service styles', () => {
    expect(normalizeServiceStyleForPricingLock('at_vendor')).toBe('at_center');
    expect(normalizeServiceStyleForPricingLock('home')).toBe('at_home');
    expect(normalizeServiceStyleForPricingLock('tele')).toBe('tele');
  });

  it('locks at_home and at_center only', () => {
    expect(isPricingLockedServiceStyle('at_home')).toBe(true);
    expect(isPricingLockedServiceStyle('at_center')).toBe(true);
    expect(isPricingLockedServiceStyle('tele')).toBe(false);
  });

  it('isWarmpawzPayActive reads commerce resolver', async () => {
    mockActiveModel('warmpawz_pay');
    await expect(isWarmpawzPayActive()).resolves.toBe(true);
    mockActiveModel('marketplace');
    await expect(isWarmpawzPayActive()).resolves.toBe(false);
  });

  it('isWarmpawzPayPricingLocked combines switch and style', async () => {
    mockActiveModel('warmpawz_pay');
    await expect(isWarmpawzPayPricingLocked('at_home')).resolves.toBe(true);
    await expect(isWarmpawzPayPricingLocked('tele')).resolves.toBe(false);

    mockActiveModel('marketplace');
    await expect(isWarmpawzPayPricingLocked('at_home')).resolves.toBe(false);
  });

  it('does not lock package rows under Warmpawz Pay', async () => {
    mockActiveModel('warmpawz_pay');
    await expect(isWarmpawzPayPricingLocked('at_home', { isPackage: true })).resolves.toBe(false);
    await expect(isWarmpawzPayPricingLocked('at_center', { isPackage: true })).resolves.toBe(false);
    await expect(isWarmpawzPayPricingLocked('at_home', { isPackage: false })).resolves.toBe(true);
  });

  it('stripVendorServicePriceFields nulls price keys', () => {
    const row = stripVendorServicePriceFields({
      id: '1',
      price: 500,
      customPrice: 400,
      name: 'Groom',
    });
    expect(row.price).toBeNull();
    expect(row.customPrice).toBeNull();
    expect(row.name).toBe('Groom');
  });

  it('vendorServicePayloadHasPriceChange detects price fields', () => {
    expect(vendorServicePayloadHasPriceChange({ isEnabled: true })).toBe(false);
    expect(vendorServicePayloadHasPriceChange({ customPrice: 100 })).toBe(true);
  });
});
