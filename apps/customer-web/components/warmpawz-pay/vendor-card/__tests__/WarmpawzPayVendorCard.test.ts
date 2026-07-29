/** @jest-environment jsdom */

import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WarmpawzPayVendorCard } from '../WarmpawzPayVendorCard';
import type { WarmpawzPayVendorCardProps } from '../types';

function renderCard(overrides: Partial<WarmpawzPayVendorCardProps> = {}) {
  const props: WarmpawzPayVendorCardProps = {
    name: 'Paws & Claws Grooming',
    ...overrides,
  };
  return render(createElement(WarmpawzPayVendorCard, props));
}

describe('WarmpawzPayVendorCard', () => {
  it('renders vendor name and optional subtitle', () => {
    renderCard({ subtitle: 'Salon · At center' });

    expect(screen.getByRole('heading', { name: 'Paws & Claws Grooming' })).toBeTruthy();
    expect(screen.getByText('Salon · At center')).toBeTruthy();
  });

  it('renders with minimal required props (name only)', () => {
    renderCard();

    expect(screen.getByRole('heading', { name: 'Paws & Claws Grooming' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows avatar initial fallback when imageUrl is missing', () => {
    renderCard({ imageUrl: null });

    expect(screen.queryByRole('img', { name: 'Paws & Claws Grooming' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Avatar for Paws & Claws Grooming' })).toBeTruthy();
    expect(screen.getByText('P')).toBeTruthy();
  });

  it('shows avatar image when imageUrl is provided', () => {
    renderCard({ imageUrl: 'https://example.com/photo.jpg' });

    const img = screen.getByRole('img', { name: 'Paws & Claws Grooming' });
    expect(img.getAttribute('src')).toBe('https://example.com/photo.jpg');
  });

  it('omits rating block when rating prop is absent', () => {
    renderCard({ rating: null });

    expect(screen.queryByText(/review/i)).toBeNull();
  });

  it('renders rating when provided with reviews', () => {
    renderCard({ rating: { average: 4.5, reviewCount: 12 } });

    expect(screen.getByText('4.5')).toBeTruthy();
    expect(screen.getByText('(12)')).toBeTruthy();
  });

  it('omits address row when address is missing', () => {
    renderCard({ address: undefined });

    expect(screen.queryByText('123 Main St')).toBeNull();
  });

  it('renders address when provided', () => {
    renderCard({ address: '123 Main St, Bengaluru' });

    expect(screen.getByText('123 Main St, Bengaluru')).toBeTruthy();
  });

  it('renders badges', () => {
    renderCard({
      badges: [
        { label: '15% OFF', tone: 'discount' },
        { label: 'Verified partner', tone: 'success' },
      ],
    });

    expect(screen.getByText('15% OFF')).toBeTruthy();
    expect(screen.getByText('Verified partner')).toBeTruthy();
  });

  it('renders meta items and footer hint', () => {
    renderCard({
      metaItems: [{ id: 'distance', label: '2 km away', tone: 'accent' }],
      footerHint: 'Tap to view profile & book',
    });

    expect(screen.getByText('2 km away')).toBeTruthy();
    expect(screen.getByText('Tap to view profile & book')).toBeTruthy();
  });

  it('invokes primary action callback on click', () => {
    const onPrimary = jest.fn();
    renderCard({
      primaryAction: { label: 'Book Appointment', onClick: onPrimary },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Book Appointment' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('invokes secondary action callback on click', () => {
    const onSecondary = jest.fn();
    renderCard({
      primaryAction: { label: 'Book Appointment', onClick: jest.fn() },
      secondaryAction: { label: 'Pay with Warmpawz', variant: 'outline', onClick: onSecondary },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pay with Warmpawz' }));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('disables action buttons when disabled or loading', () => {
    renderCard({
      primaryAction: { label: 'Book', onClick: jest.fn(), disabled: true },
      secondaryAction: { label: 'Pay', onClick: jest.fn(), loading: true, variant: 'outline' },
    });

    expect((screen.getByRole('button', { name: 'Book' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Pay' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('announces verified status when parent supplies verifiedAriaLabel', () => {
    renderCard({ showVerified: true, verifiedAriaLabel: 'Verified provider' });

    expect(screen.getByText('Verified provider')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Paws & Claws Grooming' })).toBeTruthy();
  });

  it('renders rich variant from props only without duplicate availability', () => {
    const onPrimary = jest.fn();
    const onProfileClick = jest.fn();
    renderCard({
      variant: 'rich',
      categoryLabel: 'Veterinarian · At center',
      rating: { average: 4.8, reviewCount: 24 },
      city: 'Mumbai',
      distanceText: '2 km away',
      address: '10 Clinic Road',
      availabilityText: 'Next: Today 4:00 PM',
      footerHint: 'Next: Today 4:00 PM',
      profileAriaLabel: 'View profile: Paws & Claws Grooming',
      onProfileClick,
      primaryAction: {
        label: 'Book Appointment',
        subtitle: 'View profile & schedule',
        variant: 'outline',
        className: 'text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42]/10',
        onClick: onPrimary,
      },
      secondaryAction: {
        label: 'Pay with Warmpawz',
        subtitle: 'Scan & pay at clinic',
        variant: 'outline',
        onClick: jest.fn(),
      },
    });

    expect(screen.getByText('Veterinarian · At center')).toBeTruthy();
    expect(screen.getByText('4.8')).toBeTruthy();
    expect(screen.getByText('(24)')).toBeTruthy();
    expect(screen.getByText('2 km away')).toBeTruthy();
    expect(screen.getAllByText('Next: Today 4:00 PM').length).toBe(1);
    expect(screen.getByText('View profile & schedule')).toBeTruthy();
    expect(screen.getByText('Scan & pay at clinic')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Book Appointment/i }));
    expect(onPrimary).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /View profile: Paws & Claws Grooming/i }));
    expect(onProfileClick).toHaveBeenCalledTimes(1);
  });

  it('omits price row when priceLabel is unavailable', () => {
    renderCard({
      rating: { average: 4.5, reviewCount: 12 },
      distanceText: '2 km away',
      priceLabel: undefined,
    });

    expect(screen.getByText('2 km away')).toBeTruthy();
    expect(screen.queryByText('₹')).toBeNull();
  });

  it('shows footer hint when it differs from availability text', () => {
    renderCard({
      availabilityText: 'Next: Today 4:00 PM',
      footerHint: 'Tap to view profile & book',
    });

    expect(screen.getByText('Next: Today 4:00 PM')).toBeTruthy();
    expect(screen.getByText('Tap to view profile & book')).toBeTruthy();
  });
});
