/**
 * @jest-environment jsdom
 */

jest.mock('@warmpawz/ui', () => {
  const React = require('react');
  return {
    Button: ({
      children,
      onClick,
      disabled,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        'button',
        { type: 'button', onClick, disabled },
        children,
      ),
  };
});

jest.mock('@/lib/warmpawz-pay-payments-export', () => ({
  ...jest.requireActual('@/lib/warmpawz-pay-payments-export'),
  downloadWpayPaymentsExcel: jest.fn(),
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { PaymentsFilterBar } from '../PaymentsFilterBar';
import { defaultWpayPaymentsFilters } from '@/lib/warmpawz-pay-payments-export';

describe('PaymentsFilterBar', () => {
  it('renders month filter default and download button', () => {
    const onFiltersChange = jest.fn();
    render(
      <PaymentsFilterBar
        filters={defaultWpayPaymentsFilters()}
        onFiltersChange={onFiltersChange}
      />,
    );

    expect(screen.getByLabelText('Month (IST)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download Excel/i })).toBeInTheDocument();
  });

  it('calls onFiltersChange when month changes', () => {
    const onFiltersChange = jest.fn();
    render(
      <PaymentsFilterBar
        filters={defaultWpayPaymentsFilters()}
        onFiltersChange={onFiltersChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Month (IST)'), {
      target: { value: '2026-07' },
    });

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'month', yearMonth: '2026-07' }),
    );
  });
});
