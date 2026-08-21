/**
 * @jest-environment jsdom
 */

import { createElement, type ChangeEvent } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AddressFromGeolocationResult } from '@/lib/address-from-geolocation';
import { CustomerUserProfile } from '@/components/customer/CustomerUserProfile';

const mockGeolocationResult: AddressFromGeolocationResult = {
  addressLine1: '48 Church Street, Bengaluru',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
  latitude: 12.9716,
  longitude: 77.5946,
  coordinates: { lat: 12.9716, lng: 77.5946 },
};

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue({ hasReferral: false }),
    post: jest.fn(),
  },
}));

jest.mock('@/lib/app-review-demo-account', () => ({
  isLoyaltyUiVisibleForAccount: () => false,
}));

jest.mock('@/lib/customer-id-storage', () => ({
  getResolvedCustomerId: () => null,
  persistCustomerDatabaseId: jest.fn(),
}));

jest.mock('@/components/shared/EnhancedAddressAutocomplete', () => ({
  EnhancedAddressAutocomplete: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (address: string) => void;
    placeholder?: string;
  }) =>
    createElement('input', {
      'data-testid': 'address-autocomplete',
      value,
      placeholder,
      onChange: (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    }),
}));

jest.mock('@/components/shared/UseCurrentLocationButton', () => ({
  UseCurrentLocationButton: ({
    onSuccess,
  }: {
    onSuccess: (result: AddressFromGeolocationResult) => void;
  }) =>
    createElement(
      'button',
      {
        type: 'button',
        onClick: () => onSuccess(mockGeolocationResult),
      },
      'Use Current Location'
    ),
}));

describe('CustomerUserProfile geolocation', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('customerCountryCode', '+91');
  });

  it('renders Use Current Location on profile creation address section', () => {
    render(
      createElement(CustomerUserProfile, {
        session: { phone: '9876543210' },
        onComplete: jest.fn(),
      })
    );

    expect(screen.getByRole('button', { name: /use current location/i })).toBeTruthy();
    expect(screen.getByTestId('address-autocomplete')).toBeTruthy();
  });

  it('fills address, city, state, and pincode when current location succeeds', () => {
    render(
      createElement(CustomerUserProfile, {
        session: { phone: '9876543210' },
        onComplete: jest.fn(),
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /use current location/i }));

    expect((screen.getByTestId('address-autocomplete') as HTMLInputElement).value).toBe(
      '48 Church Street, Bengaluru'
    );
    expect((screen.getByPlaceholderText('Mumbai') as HTMLInputElement).value).toBe('Bengaluru');
    expect((screen.getByPlaceholderText('Maharashtra') as HTMLInputElement).value).toBe('Karnataka');
    expect((screen.getByPlaceholderText('400001') as HTMLInputElement).value).toBe('560001');
  });
});
