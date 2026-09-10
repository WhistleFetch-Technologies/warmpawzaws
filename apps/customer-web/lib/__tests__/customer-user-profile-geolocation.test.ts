/**
 * @jest-environment jsdom
 */

import { createElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CustomerUserProfile } from '@/components/customer/CustomerUserProfile';
import { apiClient } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue({ hasReferral: false }),
    post: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock('@/lib/customer-id-storage', () => ({
  getResolvedCustomerId: () => null,
  persistCustomerDatabaseId: jest.fn(),
}));

describe('CustomerUserProfile creation fields', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('customerCountryCode', '+91');
    jest.clearAllMocks();
  });

  it('renders only optional photo, name, and login phone', () => {
    render(
      createElement(CustomerUserProfile, {
        session: { phone: '9876543210' },
        onComplete: jest.fn(),
      })
    );

    expect(screen.getByText('Add Photo')).toBeTruthy();
    expect(screen.getByText(/optional/i)).toBeTruthy();
    expect(screen.getByPlaceholderText('John Doe')).toBeTruthy();
    expect(screen.getByDisplayValue('9876543210')).toBeTruthy();
    expect(screen.getByText('Phone number from your login')).toBeTruthy();

    expect(screen.queryByPlaceholderText('john.doe@example.com')).toBeNull();
    expect(screen.queryByPlaceholderText('Search address, landmark, city...')).toBeNull();
    expect(screen.queryByPlaceholderText('e.g., A-101, Flat 12B')).toBeNull();
    expect(screen.queryByPlaceholderText('e.g., 1st Floor')).toBeNull();
    expect(screen.queryByPlaceholderText('Mumbai')).toBeNull();
    expect(screen.queryByPlaceholderText('Maharashtra')).toBeNull();
    expect(screen.queryByPlaceholderText('400001')).toBeNull();
    expect(screen.queryByRole('button', { name: /use current location/i })).toBeNull();
    expect(screen.queryByText(/referral code/i)).toBeNull();
  });

  it('keeps login phone read-only', () => {
    render(
      createElement(CustomerUserProfile, {
        session: { phone: '8552333155' },
        onComplete: jest.fn(),
      })
    );

    const phoneInput = screen.getByDisplayValue('8552333155') as HTMLInputElement;
    expect(phoneInput.readOnly).toBe(true);
  });

  it('posts first and last name from a single Name field', async () => {
    const onComplete = jest.fn();
    render(
      createElement(CustomerUserProfile, {
        session: { phone: '9876543210' },
        onComplete,
      })
    );

    fireEvent.change(screen.getByPlaceholderText('John Doe'), {
      target: { value: 'John Doe' },
    });
    fireEvent.click(screen.getByRole('button', { name: /complete & continue/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/customer/profile', {
        phone: '9876543210',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          phone: '9876543210',
        },
        journeyType: undefined,
      });
    });
    expect(onComplete).toHaveBeenCalled();
  });
});
