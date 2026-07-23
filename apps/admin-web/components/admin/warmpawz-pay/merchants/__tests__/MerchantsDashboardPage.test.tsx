/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { MerchantsDashboardPage } from '../MerchantsDashboardPage';
import { useMerchantsList } from '@/hooks/warmpawz-pay/useMerchants';
import type { MerchantListItem } from '@/lib/warmpawz-pay-merchants-admin';

jest.mock('@/hooks/warmpawz-pay/useMerchants');

jest.mock('@warmpawz/ui', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

jest.mock('@/components/admin/warmpawz-pay/shared/WarmpawzPayShell', () => ({
  WarmpawzPayShell: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: string;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

jest.mock('@/components/admin/marketing/analytics/AnalyticsStateViews', () => ({
  AnalyticsErrorState: ({
    message,
    onRetry,
  }: {
    message: string;
    onRetry?: () => void;
  }) => (
    <div>
      <p>{message}</p>
      {onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}
    </div>
  ),
}));

jest.mock('@/components/admin/warmpawz-pay/catalogue/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
}));

jest.mock('@/components/admin/warmpawz-pay/catalogue/LoadingSkeleton', () => ({
  LoadingSkeleton: () => <div className="animate-pulse" />,
}));

jest.mock('@/components/admin/warmpawz-pay/catalogue/Pagination', () => ({
  Pagination: () => <div>Pagination</div>,
}));

jest.mock('@/components/admin/warmpawz-pay/catalogue/SearchBar', () => ({
  SearchBar: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      aria-label="Search business names..."
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

jest.mock('../MerchantsTable', () => ({
  MerchantsTable: ({ items }: { items: MerchantListItem[] }) =>
    items.length === 0 ? (
      <p>No merchants found</p>
    ) : (
      <div>
        {items.map((item) => (
          <div key={item.catalogueId}>
            <span>{item.businessName}</span>
            <span>
              {item.readiness.blockersPassed}/{item.readiness.blockersTotal}
            </span>
          </div>
        ))}
      </div>
    ),
}));

const mockUseMerchantsList = useMerchantsList as jest.MockedFunction<
  typeof useMerchantsList
>;

const sampleMerchant: MerchantListItem = {
  catalogueId: 'cat-1',
  vendorId: 'vendor-1',
  vendorName: 'Anjali Sharma',
  businessName: 'Happy Paws',
  city: 'Bengaluru',
  category: 'Grooming',
  businessType: 'Solo',
  platformStatus: 'Approved',
  warmpawzPayStatus: 'Published',
  customerVisible: true,
  updatedAt: '2026-07-23T12:00:00.000Z',
  readiness: {
    checks: [],
    blockersPassed: 4,
    blockersTotal: 4,
    readyForPayBill: true,
  },
};

describe('MerchantsDashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading skeleton while merchants are loading', () => {
    mockUseMerchantsList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      error: null,
      refresh: jest.fn(),
    });

    const { container } = render(<MerchantsDashboardPage />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders merchant table on success', () => {
    mockUseMerchantsList.mockReturnValue({
      data: {
        items: [sampleMerchant],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refresh: jest.fn(),
    });

    render(<MerchantsDashboardPage />);

    expect(screen.getByText('Happy Paws')).toBeInTheDocument();
    expect(screen.getByText('4/4')).toBeInTheDocument();
  });

  it('renders error state with retry', () => {
    const refresh = jest.fn();
    mockUseMerchantsList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: new Error('Network error'),
      refresh,
    });

    render(<MerchantsDashboardPage />);

    expect(screen.getByText('Network error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when no merchants are returned', () => {
    mockUseMerchantsList.mockReturnValue({
      data: {
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refresh: jest.fn(),
    });

    render(<MerchantsDashboardPage />);

    expect(screen.getByText('No merchants found')).toBeInTheDocument();
  });
});
