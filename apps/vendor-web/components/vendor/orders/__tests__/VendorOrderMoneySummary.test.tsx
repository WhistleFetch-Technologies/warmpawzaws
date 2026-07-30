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
});
