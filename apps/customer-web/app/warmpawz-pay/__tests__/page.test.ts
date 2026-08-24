/** @jest-environment jsdom */

import { createElement } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import WarmpawzPayPage from '../page';
import { useWpayVendorFeed } from '@/hooks/useWpayVendorFeed';

jest.mock('@/hooks/useWpayVendorFeed', () => ({
  useWpayVendorFeed: jest.fn(),
}));

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockUseWpayVendorFeed = useWpayVendorFeed as jest.MockedFunction<typeof useWpayVendorFeed>;

describe('WarmpawzPayPage loading UX', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPush.mockReset();
    mockUseWpayVendorFeed.mockReturnValue({
      vendors: [
        {
          vendorId: 'vendor-1',
          name: 'Stale Vet Clinic',
          phone: null,
          address: 'Old address',
          photoUrl: null,
          discountPercent: 0,
          category: 'vet',
        },
      ],
      loading: true,
      loadingMore: false,
      hasMore: false,
      error: null,
      loadMore: jest.fn(),
      reload: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hides vendor rows during a full reload so stale data is not shown', () => {
    render(createElement(WarmpawzPayPage));

    expect(screen.getByText('Loading vendors…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'View Stale Vet Clinic' })).toBeNull();
  });

  it('exposes a meaningful aria-label on vendor rows when loaded', () => {
    mockUseWpayVendorFeed.mockReturnValue({
      vendors: [
        {
          vendorId: 'vendor-1',
          name: 'Happy Tails',
          phone: null,
          address: 'Main St',
          photoUrl: null,
          discountPercent: 10,
          category: 'grooming',
        },
      ],
      loading: false,
      loadingMore: false,
      hasMore: false,
      error: null,
      loadMore: jest.fn(),
      reload: jest.fn(),
    });

    render(createElement(WarmpawzPayPage));

    expect(screen.getByRole('button', { name: 'View Happy Tails' })).toBeTruthy();
  });

  it('opens Pay Bill for a guest without requiring login first', () => {
    mockUseWpayVendorFeed.mockReturnValue({
      vendors: [
        {
          vendorId: 'vendor-1',
          name: 'Happy Tails',
          phone: null,
          address: 'Main St',
          photoUrl: null,
          discountPercent: 10,
          category: 'grooming',
        },
      ],
      loading: false,
      loadingMore: false,
      hasMore: false,
      error: null,
      loadMore: jest.fn(),
      reload: jest.fn(),
    });

    render(createElement(WarmpawzPayPage));
    fireEvent.click(screen.getByRole('button', { name: 'View Happy Tails' }));

    expect(mockPush).toHaveBeenCalledWith('/warmpawz-pay/vendors/vendor-1');
  });

  it('renders Pet Sitting and Nutrition category filters', () => {
    mockUseWpayVendorFeed.mockReturnValue({
      vendors: [],
      loading: false,
      loadingMore: false,
      hasMore: false,
      error: null,
      loadMore: jest.fn(),
      reload: jest.fn(),
    });

    render(createElement(WarmpawzPayPage));

    expect(screen.getByRole('button', { name: 'Pet Sitting' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nutrition' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Walking' })).toBeTruthy();
  });

  it('debounces search and passes q to vendor feed', () => {
    mockUseWpayVendorFeed.mockReturnValue({
      vendors: [],
      loading: false,
      loadingMore: false,
      hasMore: false,
      error: null,
      loadMore: jest.fn(),
      reload: jest.fn(),
    });

    render(createElement(WarmpawzPayPage));

    fireEvent.change(screen.getByLabelText('Search Warmpawz Pay vendors'), {
      target: { value: 'best trainers for my dog' },
    });

    expect(mockUseWpayVendorFeed).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: undefined, category: 'all' }),
    );

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockUseWpayVendorFeed).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'best trainers for my dog', category: 'all' }),
    );
  });
});
