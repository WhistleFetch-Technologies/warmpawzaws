/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { MetricsGrid } from '../MetricsGrid';
import type { DashboardMetrics } from '@/lib/warmpawz-pay-dashboard-admin';

// next/jest rewrites lucide named imports to per-icon ESM files that it does not transpile.
jest.mock('lucide-react/dist/esm/icons/file-text', () => ({ __esModule: true, default: () => null }));
jest.mock('lucide-react/dist/esm/icons/indian-rupee', () => ({ __esModule: true, default: () => null }));
jest.mock('lucide-react/dist/esm/icons/landmark', () => ({ __esModule: true, default: () => null }));
jest.mock('lucide-react/dist/esm/icons/layers', () => ({ __esModule: true, default: () => null }));
jest.mock('lucide-react/dist/esm/icons/percent', () => ({ __esModule: true, default: () => null }));
jest.mock('lucide-react/dist/esm/icons/receipt', () => ({ __esModule: true, default: () => null }));
jest.mock('lucide-react/dist/esm/icons/store', () => ({ __esModule: true, default: () => null }));
jest.mock('lucide-react/dist/esm/icons/trending-up', () => ({ __esModule: true, default: () => null }));
jest.mock('lucide-react/dist/esm/icons/wallet', () => ({ __esModule: true, default: () => null }));

jest.mock('@/components/admin/shared/MetricCard', () => ({
  metricAvailabilityFromFlag: (available: boolean) => (available ? 'available' : 'unavailable'),
  MetricCard: ({
    title,
    value,
    subtitle,
    unavailableLabel,
  }: {
    title: string;
    value?: string;
    subtitle?: string;
    unavailableLabel?: string;
  }) => (
    <div>
      <h3>{title}</h3>
      <p>{value ?? unavailableLabel}</p>
      <p>{subtitle}</p>
    </div>
  ),
}));

const metrics: DashboardMetrics = {
  publishedMerchants: { value: 99 },
  averageDiscountPercent: { value: 2.2 },
  draftUnpublished: { value: 0 },
  payEnabledTiers: { value: 1 },
  payBillOrders: { value: 119 },
  customerPaid: { value: 259780.7 },
  customerSaved: { value: 30108.8 },
  platformRevenue: { value: null, available: false },
  platformFee: { value: 2475 },
  platformFeeGst: { value: 445.5 },
};

describe('MetricsGrid', () => {
  it('shows Platform Fee and Platform Fee GST totals even when Platform Revenue is hidden', () => {
    render(<MetricsGrid metrics={metrics} moneyPeriodLabel="2026-10 (IST)" />);

    expect(screen.getByText('Platform Revenue')).toBeInTheDocument();
    expect(screen.getByText('Hidden while Burn / Test mode is active')).toBeInTheDocument();
    expect(screen.getByText('Platform Fee')).toBeInTheDocument();
    expect(screen.getByText('Platform Fee GST')).toBeInTheDocument();
    expect(screen.getByText('₹2,475.00')).toBeInTheDocument();
    expect(screen.getByText('₹445.50')).toBeInTheDocument();
  });

  it('falls back to ₹0.00 when an older API omits the platform fee totals', () => {
    const { platformFee: _fee, platformFeeGst: _gst, ...legacy } = metrics;
    render(<MetricsGrid metrics={legacy} />);

    expect(screen.getAllByText('₹0.00').length).toBeGreaterThanOrEqual(2);
  });
});
