/** @jest-environment jsdom */

import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { VendorFeedbackSheet, type VendorFeedbackSheetProps } from '../VendorFeedbackSheet';
import { mapFeedbackVendorToCardProps } from '@/lib/vendor-feedback/map-feedback-vendor-to-card-props';
import type { VendorFeedbackPrompt } from '@/lib/vendor-feedback/types';

const prompt: VendorFeedbackPrompt = {
  sourceType: 'payment',
  sourceId: '22222222-2222-4222-8222-222222222222',
  bookingId: null,
  paymentId: '22222222-2222-4222-8222-222222222222',
  kind: 'warmpawz_pay',
  title: 'Leave a review for your previous Warmpawz Pay transaction',
  transactionAt: '2026-10-12T09:30:00.000Z',
  vendor: {
    vendorId: 'v-1',
    name: 'Amigo Pet Hospital',
    photoUrl: null,
    categoryLabel: 'Veterinary Clinic',
    isVerified: true,
    distanceKm: 162,
    distanceText: '162 km away',
    address: 'Indiranagar, Bengaluru',
  },
};

function renderSheet(overrides: Partial<VendorFeedbackSheetProps> = {}) {
  const onSubmit = jest.fn();
  const onContinue = jest.fn();
  const props: VendorFeedbackSheetProps = {
    open: true,
    subtitle: prompt.title,
    vendorCard: mapFeedbackVendorToCardProps(prompt),
    onSubmit,
    onContinue,
    ...overrides,
  };
  render(createElement(VendorFeedbackSheet, props));
  return { onSubmit, onContinue };
}

describe('mapFeedbackVendorToCardProps', () => {
  it('builds the compact card with a "Serviced on" row and no actions', () => {
    const props = mapFeedbackVendorToCardProps(prompt);
    expect(props.variant).toBe('compact');
    expect(props.showVerified).toBe(true);
    expect(props.distanceText).toBe('162 km away');
    expect(props.metaItems?.[0].label).toBe('Serviced on: 12 Oct 2026');
    expect(props.primaryAction).toBeUndefined();
  });

  it('omits the "Serviced on" row when the date is missing', () => {
    expect(mapFeedbackVendorToCardProps({ ...prompt, transactionAt: null }).metaItems).toBeUndefined();
  });
});

describe('VendorFeedbackSheet', () => {
  it('shows the transaction title and vendor card', () => {
    renderSheet();
    expect(screen.getByText('How was your experience?')).toBeTruthy();
    expect(screen.getByText(prompt.title)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Amigo Pet Hospital' })).toBeTruthy();
    expect(screen.getByText('Veterinary Clinic')).toBeTruthy();
    expect(screen.getByText('162 km away')).toBeTruthy();
    expect(screen.getByText('Indiranagar, Bengaluru')).toBeTruthy();
    expect(screen.getByText('Serviced on: 12 Oct 2026')).toBeTruthy();
  });

  it('keeps Submit disabled until a star is picked, then submits rating + comment', () => {
    const { onSubmit } = renderSheet();
    const submit = screen.getByRole('button', { name: /submit feedback/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.click(screen.getByRole('radio', { name: '4 stars' }));
    fireEvent.change(screen.getByLabelText('Tell us more (optional)'), {
      target: { value: 'Very caring staff' },
    });
    expect(screen.getByText('17/500')).toBeTruthy();
    expect(screen.getByText('Very good')).toBeTruthy();

    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith({ rating: 4, comment: 'Very caring staff' });
  });

  it('Continue to Home calls onContinue', () => {
    const { onContinue } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Home' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('shows the error text when provided', () => {
    renderSheet({ errorText: 'Could not submit your feedback. Please try again.' });
    expect(screen.getByRole('alert').textContent).toContain('Could not submit');
  });
});
