/** @jest-environment jsdom */

import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import WarmpawzPayPage from '../page';
import { useWpayVendorFeed } from '@/hooks/useWpayVendorFeed';

jest.mock('@/hooks/useWpayVendorFeed', () => ({
  useWpayVendorFeed: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockUseWpayVendorFeed = useWpayVendorFeed as jest.MockedFunction<typeof useWpayVendorFeed>;

describe('WarmpawzPayPage loading UX', () => {
  beforeEach(() => {
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
});
