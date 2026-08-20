/**
 * @jest-environment jsdom
 */

import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  shouldEnableCustomerHomeTrustSupport,
  shouldRenderCustomerHomeNeedHelp,
} from '../customer-home-guest-support';
import { TrustFeatureBar } from '../../components/customer/home/sections/TrustFeatureBar';

describe('Fix 4 — Guest Home Support composition', () => {
  it('does not render Need Help for guests', () => {
    expect(shouldRenderCustomerHomeNeedHelp(true)).toBe(false);
  });

  it('does not render legacy Need Help for guests', () => {
    expect(shouldRenderCustomerHomeNeedHelp(true)).toBe(false);
  });

  it('still renders Support / Need Help for authenticated Home', () => {
    expect(shouldRenderCustomerHomeNeedHelp(false)).toBe(true);
  });

  it('does not enable Home Trust Support navigation for guests', () => {
    expect(shouldEnableCustomerHomeTrustSupport(true)).toBe(false);
  });

  it('keeps Home Trust Support navigation for authenticated customers', () => {
    expect(shouldEnableCustomerHomeTrustSupport(false)).toBe(true);
  });

  it('does not navigate to support_help when Trust bar onNavigate is omitted', () => {
    render(createElement(TrustFeatureBar));
    expect(screen.queryByRole('button', { name: /open support/i })).toBeNull();
    expect(screen.getByLabelText('24/7 Support')).toBeTruthy();
  });

  it('navigates to support_help when Trust bar onNavigate is provided', () => {
    const onNavigate = jest.fn();
    render(createElement(TrustFeatureBar, { onNavigate }));
    fireEvent.click(screen.getByRole('button', { name: /open support/i }));
    expect(onNavigate).toHaveBeenCalledWith('support_help', { initialTab: 'contact' });
  });
});
