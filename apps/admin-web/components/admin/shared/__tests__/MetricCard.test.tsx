/**
 * @jest-environment jsdom
 */

import type { SVGProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '../MetricCard';

jest.mock('@warmpawz/ui', () => ({
  Card: ({
    children,
    className,
    ...props
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="metric-card" className={className} {...props}>
      {children}
    </div>
  ),
  CardContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

function MockIcon(props: SVGProps<SVGSVGElement>) {
  return <svg data-testid="metric-icon" {...props} />;
}

describe('MetricCard', () => {
  it('renders an available metric with formatted value and subtitle', () => {
    render(
      <MetricCard
        title="Revenue"
        value="₹1,25,000.00"
        subtitle="Total Warmpawz Pay revenue"
        icon={MockIcon as unknown as LucideIcon}
        iconClassName="text-green-500"
        valueClassName="text-green-600"
      />,
    );

    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('₹1,25,000.00')).toBeInTheDocument();
    expect(screen.getByText('Total Warmpawz Pay revenue')).toBeInTheDocument();
    expect(screen.getByLabelText('Revenue, ₹1,25,000.00')).toBeInTheDocument();
  });

  it('renders unavailable metrics with the default coming soon label', () => {
    render(
      <MetricCard
        title="Orders"
        subtitle="Warmpawz Pay orders"
        icon={MockIcon as unknown as LucideIcon}
        availability="unavailable"
      />,
    );

    expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    expect(screen.getByLabelText('Orders, coming soon')).toBeInTheDocument();
  });

  it('supports a custom unavailable label', () => {
    render(
      <MetricCard
        title="Settlements"
        subtitle="Pending settlements"
        icon={MockIcon as unknown as LucideIcon}
        availability="unavailable"
        unavailableLabel="Not available yet"
      />,
    );

    expect(screen.getByText('Not available yet')).toBeInTheDocument();
    expect(screen.getByLabelText('Settlements, not available yet')).toBeInTheDocument();
  });

  it('renders a loading placeholder without showing a value', () => {
    render(
      <MetricCard
        title="Orders"
        subtitle="Warmpawz Pay orders"
        icon={MockIcon as unknown as LucideIcon}
        availability="loading"
      />,
    );

    expect(screen.getByLabelText('Orders, loading')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Coming Soon')).not.toBeInTheDocument();
  });
});
