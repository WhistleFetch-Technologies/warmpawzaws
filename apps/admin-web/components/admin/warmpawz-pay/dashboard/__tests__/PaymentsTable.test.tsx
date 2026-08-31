/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
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

const sampleItem: WpayAdminPaymentItem = {
  paymentId: 'pay-1',
  customer: { name: 'Sonu M', phone: '+917204349568' },
  vendor: { name: 'Bindu Vet Clinic', category: 'Vet' },
  commercialModel: 'withhold',
  originalAmount: 1570,
  discountPercent: 10,
  discountAmount: 157,
  payableAmount: 1332,
  platformWithholdPercent: 5,
  platformWithholdAmount: 66.6,
  vendorSettlementAmount: 1265.4,
  paidAt: '2026-08-06T06:41:00.000Z',
};

describe('PaymentsTable', () => {
  it('renders vendor settlement and withhold columns', () => {
    render(
      <PaymentsTable
        items={[sampleItem]}
        page={1}
        pageSize={5}
        total={1}
        onPageChange={() => undefined}
      />,
    );

    expect(screen.getByText('Platform Withhold (%)')).toBeInTheDocument();
    expect(screen.getByText('Platform Withhold (₹)')).toBeInTheDocument();
    expect(screen.getByText('Vendor Settlement')).toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument();
    expect(screen.getByText('₹1,265.40')).toBeInTheDocument();
  });
});
