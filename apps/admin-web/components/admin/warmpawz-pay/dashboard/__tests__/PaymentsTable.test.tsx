/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { PaymentsTable } from '../PaymentsTable';
import type { WpayAdminPaymentItem } from '@/lib/warmpawz-pay-payments-admin';

jest.mock('@warmpawz/ui', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <tr className={className}>{children}</tr>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td>{children}</td>,
}));

jest.mock('@/components/admin/warmpawz-pay/catalogue/Pagination', () => ({
  Pagination: () => null,
}));

const selectionProps = {
  selectedPaymentIds: new Set<string>(),
  onSelectedPaymentIdsChange: () => undefined,
};

const burnItem: WpayAdminPaymentItem = {
  paymentId: 'pay-burn-1',
  customer: { name: 'Sonu M', phone: '+917204349568' },
  vendor: { name: 'Bindu Vet Clinic', category: 'Vet', tierName: 'Gold' },
  commercialModel: 'tier_commission',
  originalAmount: 10000,
  discountPercent: 15,
  discountAmount: 1500,
  payableAmount: 8559,
  commissionPercent: 20,
  vendorPayableAmount: 10000,
  vendorSettlementAmount: 10000,
  wpayRevenueAmount: 0,
  platformGstAmount: 0,
  finalGstAmount: 9,
  burnMode: true,
  burnAmount: 1441,
  payoutStatus: 'pending',
  settlementId: 'set-burn-1',
  paidAt: '2026-08-06T06:41:00.000Z',
};

describe('PaymentsTable', () => {
  it('shows N/A for burn-mode tier, platform revenue, and drawer platform GST', () => {
    render(
      <PaymentsTable
        items={[burnItem]}
        page={1}
        pageSize={5}
        total={1}
        onPageChange={() => undefined}
        {...selectionProps}
      />,
    );

    expect(screen.getByText('Platform Revenue')).toBeInTheDocument();
    expect(screen.getByText('Payout')).toBeInTheDocument();
    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Final GST/i)).toBeInTheDocument();
    expect(screen.getByText('₹9.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(screen.getByText('Tier commission')).toBeInTheDocument();
    expect(screen.getByText('Platform GST (inclusive)')).toBeInTheDocument();
    expect(screen.getByText('Burn amount')).toBeInTheDocument();
    expect(screen.getByText('₹1,441.00')).toBeInTheDocument();
    expect(screen.getByText('On')).toBeInTheDocument();
    expect(screen.getByText(/Promo & wallet reconciliation/i)).toBeInTheDocument();
    expect(screen.getByText('Wallet / cashback used')).toBeInTheDocument();
    expect(screen.getByText('Discount ₹')).toBeInTheDocument();
    expect(screen.getByText('Wallet Used')).toBeInTheDocument();
  });

  it('shows Platform Fee and Platform Fee GST columns, also in burn mode', () => {
    const { container } = render(
      <PaymentsTable
        items={[{ ...burnItem, platformFee: 45, platformFeeGstAmount: 8.1, finalGstAmount: 8.1 }]}
        page={1}
        pageSize={5}
        total={1}
        onPageChange={() => undefined}
        {...selectionProps}
      />,
    );

    const headers = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent);
    const feeIdx = headers.indexOf('Platform Fee');
    const feeGstIdx = headers.indexOf('Platform Fee GST');
    expect(headers.indexOf('Platform Revenue')).toBeLessThan(feeIdx);
    expect(feeGstIdx).toBe(feeIdx + 1);
    expect(headers[feeGstIdx + 1]).toBe('Final GST');

    const cells = Array.from(container.querySelectorAll('tbody tr:first-child td')).map(
      (td) => td.textContent,
    );
    expect(cells[feeIdx]).toBe('₹45.00');
    expect(cells[feeGstIdx]).toBe('₹8.10');
  });

  it('Customer Paid shows the Razorpay amount and the drawer shows appointment fee adjusted', () => {
    const { container } = render(
      <PaymentsTable
        items={[
          {
            ...burnItem,
            originalAmount: 2420,
            discountAmount: 350,
            payableAmount: 1624.1,
            appointmentFeeCredit: 499,
            walletAmount: 499,
            razorpayChargeAmount: 1125.1,
          },
        ]}
        page={1}
        pageSize={5}
        total={1}
        onPageChange={() => undefined}
        {...selectionProps}
      />,
    );

    const headers = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent);
    const paidIdx = headers.indexOf('Customer Paid');
    const cells = Array.from(container.querySelectorAll('tbody tr:first-child td'));
    const paidCell = cells[paidIdx]!;
    expect(paidCell.querySelector('span')?.textContent).toBe('₹1,125.10');
    expect(paidCell.textContent).toContain('Bill ₹1,624.10');

    expect(screen.queryByText('Appointment fee adjusted')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    const label = screen.getByText('Appointment fee adjusted');
    expect(label.nextElementSibling?.textContent).toBe('₹499.00');
  });

  it('hides appointment fee adjusted and the bill sub-line when there is no credit or wallet', () => {
    const { container } = render(
      <PaymentsTable
        items={[{ ...burnItem, appointmentFeeCredit: 0, walletAmount: 0 }]}
        page={1}
        pageSize={5}
        total={1}
        onPageChange={() => undefined}
        {...selectionProps}
      />,
    );

    const headers = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent);
    const paidCell = container.querySelectorAll('tbody tr:first-child td')[headers.indexOf('Customer Paid')]!;
    expect(paidCell.textContent).toBe('₹8,559.00');

    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(screen.queryByText('Appointment fee adjusted')).not.toBeInTheDocument();
  });

  it('tints pending rows and allows selecting only pending payouts', () => {
    const onSelectedPaymentIdsChange = jest.fn();
    const settled: WpayAdminPaymentItem = {
      ...burnItem,
      paymentId: 'pay-settled-1',
      payoutStatus: 'settled',
      settlementId: 'set-2',
      burnMode: false,
    };

    const { container } = render(
      <PaymentsTable
        items={[burnItem, settled]}
        page={1}
        pageSize={5}
        total={2}
        onPageChange={() => undefined}
        selectedPaymentIds={new Set()}
        onSelectedPaymentIdsChange={onSelectedPaymentIdsChange}
      />,
    );

    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0]?.className).toMatch(/bg-amber/);
    expect(rows[1]?.className).toMatch(/bg-green/);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]!);
    expect(onSelectedPaymentIdsChange).toHaveBeenCalled();
    expect(checkboxes[2]).toBeDisabled();
  });
});
