/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { VendorOrderMoneySummary } from '@/components/vendor/orders/VendorOrderMoneySummary';

describe('VendorOrderMoneySummary', () => {
  it('does not show shipping or customer paid lines', () => {
    render(
      <VendorOrderMoneySummary
        order={{
          subtotal: 310,
          shipping_amount: 150,
          total_amount: 444.5,
          promotion_source: 'admin',
          admin_promotion_amount: 15.5,
          commission_rate: 25,
          commission_amount: 77.5,
          vendor_payout_amount: 232.5,
        }}
      />
    );

    expect(screen.getByText('Item total (your catalog price)')).toBeTruthy();
    expect(screen.getByText('Settlement base (your goods)')).toBeTruthy();
    expect(screen.getByText('Your payout')).toBeTruthy();
    expect(screen.queryByText('Shipping (customer paid)')).toBeNull();
    expect(screen.queryByText('Customer paid')).toBeNull();
  });

  it('shows per-line commission when snapshot has mixed rates', () => {
    render(
      <VendorOrderMoneySummary
        order={{
          subtotal: 310,
          commission_rate: 8.6,
          commission_amount: 26.65,
          vendor_payout_amount: 283.35,
          commission_snapshot: {
            effectiveRate: 8.6,
            commissionAmount: 26.65,
            orderSubtotal: 310,
            lineBreakdown: [
              {
                productId: 'p-own',
                rate: 7,
                commission: 14.77,
                source: 'vendor_own_brand',
                listingOwnership: 'own_brand',
              },
              {
                productId: 'p-3p',
                rate: 12,
                commission: 11.88,
                source: 'vendor_third_party',
                listingOwnership: 'third_party',
              },
            ],
          },
          items: [
            { product_id: 'p-own', name: 'Whiskas Tuna' },
            { product_id: 'p-3p', name: 'Kitty Yums' },
          ],
        }}
      />
    );

    expect(screen.getByText(/Platform commission \(mixed rates\)/)).toBeTruthy();
    expect(screen.getByText(/Whiskas Tuna \(own brand\)/)).toBeTruthy();
    expect(screen.getByText(/Kitty Yums \(third party\)/)).toBeTruthy();
  });
});
