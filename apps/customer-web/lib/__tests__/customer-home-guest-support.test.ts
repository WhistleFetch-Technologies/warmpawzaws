/**
 * @jest-environment jsdom
 */

import * as fs from 'fs';
import * as path from 'path';
import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  shouldEnableCustomerHomeTrustSupport,
  shouldRenderCustomerHomeNeedHelp,
} from '../customer-home-guest-support';
import { TrustFeatureBar } from '../../components/customer/home/sections/TrustFeatureBar';
import { NeedHelpSection } from '../../components/customer/home/sections/NeedHelpSection';

const CUSTOMER_WEB_ROOT = path.resolve(__dirname, '../..');

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

  it('NeedHelpSection still exposes Live Chat for authenticated Home', () => {
    const onNavigate = jest.fn();
    render(createElement(NeedHelpSection, { onNavigate }));
    expect(screen.getByRole('heading', { name: /need help/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /live chat/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /live chat/i }));
    expect(onNavigate).toHaveBeenCalledWith('support_help', { initialTab: 'contact' });
  });

  it('passes isGuest into the active CustomerHomePageContent path', () => {
    const homeComplete = fs.readFileSync(
      path.join(CUSTOMER_WEB_ROOT, 'components/customer/homepage/CustomerHomeComplete.tsx'),
      'utf8'
    );
    expect(homeComplete).toMatch(/<CustomerHomePageContent[\s\S]*isGuest=\{isGuest\}/);
    expect(homeComplete).toMatch(
      /!newHomeUi && shouldRenderCustomerHomeNeedHelp\(isGuest\)/
    );
  });

  it('gates NeedHelpSection on the new Home composition with isGuest', () => {
    const homePage = fs.readFileSync(
      path.join(CUSTOMER_WEB_ROOT, 'components/customer/home/CustomerHomePage.tsx'),
      'utf8'
    );
    expect(homePage).toMatch(/shouldRenderCustomerHomeNeedHelp\(isGuest\)/);
    expect(homePage).toMatch(/<NeedHelpSection onNavigate=\{onNavigate\} \/>/);
    expect(homePage).toMatch(
      /onNavigate=\{shouldEnableCustomerHomeTrustSupport\(isGuest\) \? onNavigate : undefined\}/
    );
  });
});
