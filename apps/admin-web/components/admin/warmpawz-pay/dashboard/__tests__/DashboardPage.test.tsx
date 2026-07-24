/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { DashboardPage } from '../DashboardPage';
import { useWarmpawzPayDashboard } from '@/hooks/warmpawz-pay/useWarmpawzPayDashboard';
import type { WarmpawzPayDashboardData } from '@/lib/warmpawz-pay-dashboard-admin';

jest.mock('@/hooks/warmpawz-pay/useWarmpawzPayDashboard');

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
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  ),
}));

jest.mock('@/components/admin/warmpawz-pay/catalogue/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
}));

jest.mock('../MetricsGrid', () => ({
  MetricsGrid: ({
    metrics,
  }: {
    metrics: WarmpawzPayDashboardData['metrics'];
  }) => (
    <div>
      <span>{metrics.publishedMerchants.value}</span>
      <span>{metrics.averageDiscountPercent.value}%</span>
    </div>
  ),
}));

jest.mock('../DashboardMetricsSkeleton', () => ({
  DashboardMetricsSkeleton: () => <div className="animate-pulse" />,
}));

const mockUseWarmpawzPayDashboard = useWarmpawzPayDashboard as jest.MockedFunction<
  typeof useWarmpawzPayDashboard
>;

const sampleDashboardData: WarmpawzPayDashboardData = {
  metrics: {
    publishedMerchants: { value: 2 },
    averageDiscountPercent: { value: 12.5 },
  },
  generatedAt: '2026-07-23T12:00:00.000Z',
};

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading skeleton while dashboard is loading', () => {
    mockUseWarmpawzPayDashboard.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      error: null,
      refresh: jest.fn(),
    });

    const { container } =     render(<DashboardPage />);

    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders success metrics when dashboard data is available', () => {
    mockUseWarmpawzPayDashboard.mockReturnValue({
      data: sampleDashboardData,
      isLoading: false,
      isFetching: false,
      error: null,
      refresh: jest.fn(),
    });

    render(<DashboardPage />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('12.5%')).toBeInTheDocument();
  });

  it('renders error state with retry action on API failure', () => {
    const refresh = jest.fn();
    mockUseWarmpawzPayDashboard.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: new Error('Network error'),
      refresh,
    });

    render(<DashboardPage />);

    expect(screen.getByText('Network error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when no merchants are published', () => {
    mockUseWarmpawzPayDashboard.mockReturnValue({
      data: {
        ...sampleDashboardData,
        metrics: {
          ...sampleDashboardData.metrics,
          publishedMerchants: { value: 0 },
          averageDiscountPercent: { value: 0 },
        },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refresh: jest.fn(),
    });

    render(<DashboardPage />);

    expect(
      screen.getByText('No merchants have been published yet.'),
    ).toBeInTheDocument();
  });
});
