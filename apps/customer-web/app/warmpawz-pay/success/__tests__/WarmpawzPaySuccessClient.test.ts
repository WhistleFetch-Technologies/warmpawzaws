/**
 * @jest-environment jsdom
 */

import { createElement } from 'react';
import { act, render, screen } from '@testing-library/react';
import { WarmpawzPaySuccessClient } from '../WarmpawzPaySuccessClient';
import {
  confirmWpayPaymentFromSuccessPage,
  WPAY_CONFIRM_TIMEOUT_COPY,
  WPAY_CONFIRMING_COPY,
} from '@/lib/warmpawz-pay/wpay-success-confirm';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const search = new URLSearchParams('paymentId=pay-1&vendor=Clinic&saved=24');

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => search,
}));

jest.mock('@/lib/warmpawz-pay/wpay-api', () => ({
  readCustomerPhoneFromStorage: () => '9876543210',
  WPAY_HISTORY_PATH: '/warmpawz-pay/history',
}));

jest.mock('@/lib/warmpawz-pay/wpay-pending-return', () => ({
  clearWpayPendingReturn: jest.fn(),
}));

jest.mock('@/lib/warmpawz-pay/wpay-success-confirm', () => {
  const actual = jest.requireActual('@/lib/warmpawz-pay/wpay-success-confirm');
  return {
    ...actual,
    confirmWpayPaymentFromSuccessPage: jest.fn(),
  };
});

const confirm = confirmWpayPaymentFromSuccessPage as jest.MockedFunction<
  typeof confirmWpayPaymentFromSuccessPage
>;

describe('WarmpawzPaySuccessClient', () => {
  beforeEach(() => {
    confirm.mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
  });

  it('shows confirming copy until the backend confirms success', async () => {
    let resolveConfirm: ((value: unknown) => void) | undefined;
    confirm.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConfirm = resolve;
        }) as never,
    );

    render(createElement(WarmpawzPaySuccessClient));
    expect(screen.getByText(WPAY_CONFIRMING_COPY)).toBeTruthy();
    expect(screen.queryByText('Payment successful!')).toBeNull();
    expect(screen.queryByText(/Payment cancelled/i)).toBeNull();

    await act(async () => {
      resolveConfirm?.({
        status: 'success',
        result: { success: true, paymentId: 'pay-1', savedAmount: 24 },
      });
    });

    expect(screen.getByText('Payment successful!')).toBeTruthy();
    expect(screen.getByText(/you saved/i)).toBeTruthy();
  });

  it('shows the wallet cashback card and a View wallet action when cashback was credited', async () => {
    confirm.mockResolvedValue({
      status: 'success',
      result: { success: true, paymentId: 'pay-1', savedAmount: 0, awardedCashback: 150, cashbackExpiryDays: 30 },
    });
    await act(async () => {
      render(createElement(WarmpawzPaySuccessClient));
    });
    const card = screen.getByTestId('wpay-cashback-credited');
    expect(card.textContent).toContain('₹150.00 cashback credited!');
    expect(card.textContent).toContain('use within 30 days');
    await act(async () => {
      screen.getByText('View wallet').click();
    });
    expect(mockPush).toHaveBeenCalledWith('/wallet');
  });

  it('omits the cashback card when nothing was credited', async () => {
    confirm.mockResolvedValue({
      status: 'success',
      result: { success: true, paymentId: 'pay-1', savedAmount: 24 },
    });
    await act(async () => {
      render(createElement(WarmpawzPaySuccessClient));
    });
    expect(screen.queryByTestId('wpay-cashback-credited')).toBeNull();
    expect(screen.queryByText('View wallet')).toBeNull();
  });

  it('shows the timeout copy and never says cancelled', async () => {
    confirm.mockResolvedValue({ status: 'timeout' });
    await act(async () => {
      render(createElement(WarmpawzPaySuccessClient));
    });
    expect(screen.getByText(WPAY_CONFIRM_TIMEOUT_COPY)).toBeTruthy();
    expect(screen.queryByText(/Payment cancelled/i)).toBeNull();
    expect(screen.queryByText('Payment successful!')).toBeNull();
  });

  it('aborts confirmation when the page unmounts', async () => {
    let seenSignal: AbortSignal | undefined;
    confirm.mockImplementation(({ signal }) => {
      seenSignal = signal;
      return new Promise(() => undefined) as never;
    });

    const view = render(createElement(WarmpawzPaySuccessClient));
    expect(seenSignal?.aborted).toBe(false);
    view.unmount();
    expect(seenSignal?.aborted).toBe(true);
  });
});
