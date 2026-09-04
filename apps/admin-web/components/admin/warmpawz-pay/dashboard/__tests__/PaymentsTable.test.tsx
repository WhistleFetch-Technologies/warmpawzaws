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
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td>{children}</td>,
}));

jest.mock('@/components/admin/warmpawz-pay/catalogue/Pagination', () => ({
  Pagination: () => null,
}));

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
      />,
    );

    expect(screen.getByText('Platform Revenue')).toBeInTheDocument();
    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Final GST/i)).toBeInTheDocument();
    expect(screen.getByText('₹9.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(screen.getByText('Tier commission')).toBeInTheDocument();
    expect(screen.getByText('Platform GST (inclusive)')).toBeInTheDocument();
    expect(screen.getByText('Burn amount')).toBeInTheDocument();
    expect(screen.getByText('₹1,441.00')).toBeInTheDocument();
    expect(screen.getByText('On')).toBeInTheDocument();
  });
});
