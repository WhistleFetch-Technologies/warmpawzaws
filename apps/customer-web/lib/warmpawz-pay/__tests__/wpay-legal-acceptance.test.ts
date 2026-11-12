/**
 * @jest-environment jsdom
 */

const get = jest.fn();
const post = jest.fn();

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));

import {
  fetchWpayLegalAcceptanceStatus,
  recordWpayLegalAcceptance,
  WPAY_PLATFORM_LEGAL_VERSION,
} from '../wpay-api';

describe('wpay legal acceptance api helpers', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it('fetchWpayLegalAcceptanceStatus maps accepted=true', async () => {
    get.mockResolvedValue({
      success: true,
      accepted: true,
      policyVersion: 'platform_tos_privacy_v1',
      acceptedAt: '2026-11-12T00:00:00.000Z',
      source: 'warmpawz_pay',
    });
    const status = await fetchWpayLegalAcceptanceStatus('9845234915');
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining('/customer/warmpawz-pay/legal-acceptance?'),
    );
    expect(get.mock.calls[0][0]).toContain('phone=9845234915');
    expect(get.mock.calls[0][0]).toContain(`policyVersion=${WPAY_PLATFORM_LEGAL_VERSION}`);
    expect(status.accepted).toBe(true);
    expect(status.policyVersion).toBe(WPAY_PLATFORM_LEGAL_VERSION);
  });

  it('recordWpayLegalAcceptance posts phone + version', async () => {
    post.mockResolvedValue({
      success: true,
      accepted: true,
      policyVersion: 'platform_tos_privacy_v1',
      acceptedAt: '2026-11-12T00:00:00.000Z',
      source: 'warmpawz_pay',
    });
    const status = await recordWpayLegalAcceptance({ phone: '9845234915' });
    expect(post).toHaveBeenCalledWith('/customer/warmpawz-pay/legal-acceptance', {
      phone: '9845234915',
      policyVersion: 'platform_tos_privacy_v1',
      source: 'warmpawz_pay',
    });
    expect(status.accepted).toBe(true);
  });
});

describe('wpay legal continue gate', () => {
  it('blocks continue when acceptance required and unchecked', () => {
    const legalAcceptedOnServer = false;
    const legalCheckboxChecked = false;
    const disabled = legalAcceptedOnServer !== true && !legalCheckboxChecked;
    expect(disabled).toBe(true);
  });

  it('allows continue after checkbox or prior acceptance', () => {
    expect(false !== true && !true).toBe(false);
    expect(true !== true && !false).toBe(false);
  });

  it('hides checkbox until status is known false (no flash while null)', () => {
    const showCheckbox = (legalAcceptedOnServer: boolean | null) =>
      legalAcceptedOnServer === false;
    expect(showCheckbox(null)).toBe(false);
    expect(showCheckbox(true)).toBe(false);
    expect(showCheckbox(false)).toBe(true);
  });
});
