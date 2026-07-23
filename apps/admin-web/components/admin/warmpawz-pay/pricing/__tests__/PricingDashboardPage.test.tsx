/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { PricingDashboardPage } from '../PricingDashboardPage';
import {
  useCreatePricing,
  useDisablePricing,
  usePricingList,
  useUpdatePricing,
} from '@/hooks/warmpawz-pay/usePricing';

jest.mock('@/hooks/warmpawz-pay/usePricing');
jest.mock('@/hooks/warmpawz-pay/useCatalogue', () => ({
  useVendorCandidates: jest.fn().mockReturnValue({ data: { items: [] } }),
}));

jest.mock('@warmpawz/ui', () => ({
  Button: ({
    children,
    onClick,
    type = 'button',
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit';
  }) => (
    <button type={type} onClick={onClick}>
      {children}
    </button>
  ),
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Input: ({
    value,
    onChange,
    id,
    type = 'text',
  }: {
    value?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    id?: string;
    type?: string;
  }) => (
    <input id={id} type={type} value={value} onChange={onChange} />
  ),
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

jest.mock('@/components/admin/warmpawz-pay/shared/WarmpawzPayShell', () => ({
  WarmpawzPayShell: ({
    children,
    title,
    actions,
  }: {
    children: React.ReactNode;
    title: string;
    actions?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {actions}
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

jest.mock('@/components/admin/warmpawz-pay/catalogue/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

jest.mock('../PricingTable', () => ({
  PricingTable: ({
    items,
    onEdit,
  }: {
    items: Array<{ businessName: string; vendorId: string }>;
    onEdit: (item: { businessName: string; vendorId: string }) => void;
  }) => (
    <div>
      {items.map((item) => (
        <button key={item.vendorId} type="button" onClick={() => onEdit(item)}>
          Edit {item.businessName}
        </button>
      ))}
    </div>
  ),
}));

const mockedUsePricingList = usePricingList as jest.MockedFunction<typeof usePricingList>;
const mockedUseCreatePricing = useCreatePricing as jest.MockedFunction<typeof useCreatePricing>;
const mockedUseUpdatePricing = useUpdatePricing as jest.MockedFunction<typeof useUpdatePricing>;
const mockedUseDisablePricing = useDisablePricing as jest.MockedFunction<typeof useDisablePricing>;

describe('PricingDashboardPage', () => {
  beforeEach(() => {
    mockedUseCreatePricing.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as never);
    mockedUseUpdatePricing.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as never);
    mockedUseDisablePricing.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as never);
  });

  it('renders loading skeleton', () => {
    mockedUsePricingList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: false,
      error: null,
      refresh: jest.fn(),
    });

    render(<PricingDashboardPage />);
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders pricing table rows', () => {
    mockedUsePricingList.mockReturnValue({
      data: {
        items: [
          {
            pricingId: 'pricing-1',
            vendorId: 'vendor-1',
            merchantName: 'Anjali',
            businessName: 'Happy Paws',
            category: 'Grooming',
            discountType: 'percentage',
            discountValue: 10,
            status: 'active',
            effectiveFrom: '2026-07-01T00:00:00.000Z',
            effectiveUntil: null,
            updatedAt: '2026-07-23T00:00:00.000Z',
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refresh: jest.fn(),
    });

    render(<PricingDashboardPage />);
    expect(screen.getByText('Edit Happy Paws')).toBeTruthy();
  });

  it('renders error state with retry', () => {
    const refresh = jest.fn();
    mockedUsePricingList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: new Error('Network failed'),
      refresh,
    });

    render(<PricingDashboardPage />);
    expect(screen.getByText('Network failed')).toBeTruthy();
    fireEvent.click(screen.getByText('Retry'));
    expect(refresh).toHaveBeenCalled();
  });

  it('opens create pricing dialog', () => {
    mockedUsePricingList.mockReturnValue({
      data: {
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refresh: jest.fn(),
    });

    render(<PricingDashboardPage />);
    fireEvent.click(screen.getByText('Create Pricing'));
    expect(screen.getByText('Create Pricing', { selector: 'h2' })).toBeTruthy();
  });
});
