/** @jest-environment jsdom */

import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CalendarCheck, Tag } from 'lucide-react';
import { PremiumVendorCardCtaCard, PremiumVendorCardCtaSection } from '../PremiumVendorCardCta';
import {
  PREMIUM_VENDOR_CARD_CTA_PRIMARY_CLASS,
  PREMIUM_VENDOR_CARD_CTA_SECONDARY_CLASS,
  PREMIUM_VENDOR_CARD_CTA_TEXT_STACK_CLASS,
} from '../premium-vendor-card-cta-styles';

describe('PremiumVendorCardCta', () => {
  it('renders primary gradient card with icon and subtitle', () => {
    const onClick = jest.fn();
    render(
      createElement(PremiumVendorCardCtaCard, {
        tone: 'primary',
        action: {
          label: 'Book Appointment',
          subtitle: 'Reserve your slot',
          icon: CalendarCheck,
          onClick,
        },
      }),
    );

    const card = screen.getByRole('button', { name: /Book Appointment/i });
    expect(card.className).toContain('bg-gradient-to-r');
    expect(card.className).toContain('h-[64px]');
    expect(card.className).toContain('rounded-[11px]');
    expect(card.className).toContain(PREMIUM_VENDOR_CARD_CTA_PRIMARY_CLASS.split(' ')[0]);
    expect(screen.getByText('Reserve your slot')).toBeTruthy();
    expect(card.querySelector('svg')).toBeTruthy();
    expect(card.className).not.toContain('active:scale');

    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reserves icon slot without placeholder when icon prop is absent', () => {
    const { container } = render(
      createElement(PremiumVendorCardCtaCard, {
        tone: 'secondary',
        action: {
          label: 'Pay Bill by Warmpawz',
          onClick: jest.fn(),
        },
      }),
    );

    const card = screen.getByRole('button', { name: 'Pay Bill by Warmpawz' });
    expect(card.className).toContain(PREMIUM_VENDOR_CARD_CTA_SECONDARY_CLASS.split(' ')[0]);
    expect(card.querySelector('svg')).toBeNull();
    expect(card.querySelector('[data-slot="cta-icon-slot"]')).toBeTruthy();
  });

  it('hugs icon and text without stretching text across full card width', () => {
    const { container } = render(
      createElement(PremiumVendorCardCtaCard, {
        tone: 'primary',
        action: {
          label: 'Book Appointment',
          subtitle: 'Reserve your slot',
          icon: CalendarCheck,
          onClick: jest.fn(),
        },
      }),
    );

    const textStack = container.querySelector(
      `.${PREMIUM_VENDOR_CARD_CTA_TEXT_STACK_CLASS.split(' ').join('.')}`,
    );
    expect(textStack?.className.includes('flex-1')).toBe(false);
    expect(container.querySelector('.inline-flex')).toBeTruthy();
  });

  it('places primary left and secondary right in a two-column grid', () => {
    const { container } = render(
      createElement(PremiumVendorCardCtaSection, {
        primaryAction: {
          label: 'Book Appointment',
          subtitle: 'Reserve your slot',
          icon: CalendarCheck,
          onClick: jest.fn(),
        },
        secondaryAction: {
          label: 'Pay Bill by Warmpawz',
          subtitle: 'Get discount',
          icon: Tag,
          onClick: jest.fn(),
        },
      }),
    );

    const cards = container.querySelectorAll('button');
    expect(cards.length).toBe(2);
    expect(cards[0]?.textContent).toContain('Book Appointment');
    expect(cards[1]?.textContent).toContain('Pay Bill by Warmpawz');
    expect(container.querySelector('.grid-cols-2')).toBeTruthy();
  });

  it('collapses subtitle only while keeping icon slot reserved', () => {
    const { container } = render(
      createElement(PremiumVendorCardCtaCard, {
        tone: 'primary',
        action: {
          label: 'Book Appointment',
          onClick: jest.fn(),
        },
      }),
    );

    expect(screen.getByRole('button', { name: 'Book Appointment' })).toBeTruthy();
    expect(screen.queryByText('Reserve your slot')).toBeNull();
    expect(container.querySelector('[data-slot="cta-icon-slot"]')).toBeTruthy();
  });
});
