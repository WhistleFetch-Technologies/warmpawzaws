import { mapWpayCustomerHistoryCard } from '../customer_warmpawz_pay_transactions_get.service';
import type { WpayTransactionDbRow } from '../../repos/wpay-payment.repo';

jest.mock('../../../../../utils/customer-coordinates', () => ({
  resolveCustomerIdFromPhone: jest.fn(),
}));

const baseRow: WpayTransactionDbRow = {
  payment_id: 'pay-1',
  vendor_id: 'vendor-1',
  business_name: 'Healing Tails',
  owner_name: null,
  vendor_type: 'clinic',
  original_amount: 1000,
  discount_amount: 100,
  payable_amount: 959,
  discount_percent: 10,
  paid_at: '2026-09-04T10:00:00.000Z',
  metadata: {
    commercialModel: 'tier_commission',
    servicePayableAmount: 900,
    platformFee: 30,
    platformFeeGstAmount: 5.4,
    platformFeeGstRateSnapshot: 18,
    convenienceFee: 20,
    convenienceGstAmount: 3.6,
    convenienceGstRateSnapshot: 18,
  },
};

describe('mapWpayCustomerHistoryCard', () => {
  it('passes through stored checkout snapshot fields', () => {
    const card = mapWpayCustomerHistoryCard(baseRow);
    expect(card.originalAmount).toBe(1000);
    expect(card.discountAmount).toBe(100);
    expect(card.servicePayableAmount).toBe(900);
    expect(card.platformFee).toBe(30);
    expect(card.platformFeeGstAmount).toBe(5.4);
    expect(card.convenienceFee).toBe(20);
    expect(card.convenienceGstAmount).toBe(3.6);
    expect(card.payableAmount).toBe(959);
    expect(card.commercialModel).toBe('tier_commission');
  });

  it('parses metadata JSON strings without recomputing fees', () => {
    const card = mapWpayCustomerHistoryCard({
      ...baseRow,
      metadata: JSON.stringify(baseRow.metadata) as unknown as Record<string, unknown>,
    });
    expect(card.platformFee).toBe(30);
    expect(card.payableAmount).toBe(959);
  });
});
