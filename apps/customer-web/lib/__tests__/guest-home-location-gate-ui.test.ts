/**
 * @jest-environment jsdom
 */

import * as fs from 'fs';
import * as path from 'path';
import { createElement } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocationProvider } from '@/context/LocationContext';
import {
  GuestHomeLocationGateHost,
  GuestLocationPrompt,
} from '@/components/customer/GuestLocationPrompt';
import { writePersistedLocation } from '@/lib/location-storage';

const fillAddressFromCurrentLocation = jest.fn();

jest.mock('@/lib/address-from-geolocation', () => ({
  fillAddressFromCurrentLocation: (...args: unknown[]) => fillAddressFromCurrentLocation(...args),
  geolocationErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : 'Could not detect location',
}));

const CUSTOMER_WEB_ROOT = path.resolve(__dirname, '../..');

function renderGate(isGuest: boolean) {
  return render(
    createElement(
      LocationProvider,
      null,
      createElement(GuestHomeLocationGateHost, {
        isGuest,
        children: createElement('div', { 'data-testid': 'home-content' }, 'HOME'),
      })
    )
  );
}

describe('Guest Home location gate', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fillAddressFromCurrentLocation.mockReset();
  });

  it('renders a centered two-option gate for guests with no location', async () => {
    renderGate(true);
    expect(screen.queryByTestId('home-content')).toBeNull();
    await waitFor(() => expect(screen.getByText('Choose your location')).toBeTruthy());
    const dialog = screen.getByRole('dialog', { name: /choose your location/i });
    expect(dialog.className).toContain('max-w-md');
    expect(screen.getByRole('button', { name: /use current location/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /enter manually/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /not now/i })).toBeNull();
    expect(screen.queryByLabelText(/close/i)).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('does not dismiss when the backdrop is clicked', async () => {
    renderGate(true);
    await waitFor(() => expect(screen.getByTestId('guest-home-location-backdrop')).toBeTruthy());
    fireEvent.click(screen.getByTestId('guest-home-location-backdrop'));
    expect(screen.getByText('Choose your location')).toBeTruthy();
    expect(screen.queryByTestId('home-content')).toBeNull();
  });

  it('does not render Home content behind the gate', async () => {
    renderGate(true);
    await waitFor(() => expect(screen.getByText('Choose your location')).toBeTruthy());
    expect(screen.queryByTestId('home-content')).toBeNull();
    expect(screen.queryByText('HOME')).toBeNull();
  });

  it('does not mount Home content before a valid location exists', async () => {
    renderGate(true);
    expect(screen.queryByTestId('home-content')).toBeNull();
    await waitFor(() => expect(screen.getByText('Choose your location')).toBeTruthy());
    expect(screen.queryByTestId('home-content')).toBeNull();
  });

  it('allows Guest Home when persisted location has finite lat/lng', async () => {
    writePersistedLocation({
      v: 1,
      latitude: 12.97,
      longitude: 77.59,
      timestamp: Date.now(),
      source: 'gps',
      city: 'Bangalore',
    });
    renderGate(true);
    await waitFor(() => expect(screen.getByTestId('home-content')).toBeTruthy());
    expect(screen.queryByText('Choose your location')).toBeNull();
  });

  it('gates malformed persisted location', async () => {
    localStorage.setItem('warmpawz_location_v1', '{not-json');
    renderGate(true);
    await waitFor(() => expect(screen.getByText('Choose your location')).toBeTruthy());
    expect(screen.queryByTestId('home-content')).toBeNull();
  });

  it('gates incomplete manual_city persisted location', async () => {
    localStorage.setItem(
      'warmpawz_location_v1',
      JSON.stringify({
        v: 1,
        latitude: null,
        longitude: null,
        city: 'Mysore',
        timestamp: Date.now(),
        source: 'manual_city',
      })
    );
    renderGate(true);
    await waitFor(() => expect(screen.getByText('Choose your location')).toBeTruthy());
    expect(screen.queryByTestId('home-content')).toBeNull();
  });

  it('unlocks Home after successful GPS', async () => {
    fillAddressFromCurrentLocation.mockResolvedValue({
      latitude: 12.97,
      longitude: 77.59,
      city: 'Bangalore',
      pincode: '560001',
      state: 'Karnataka',
      addressLine2: 'Indiranagar',
    });
    renderGate(true);
    await waitFor(() => expect(screen.getByRole('button', { name: /use current location/i })).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /use current location/i }));
    });
    await waitFor(() => expect(screen.getByTestId('home-content')).toBeTruthy());
    expect(JSON.parse(String(localStorage.getItem('warmpawz_location_v1'))).latitude).toBe(12.97);
  });

  it('stays on the gate when GPS permission is denied', async () => {
    fillAddressFromCurrentLocation.mockRejectedValue(new Error('Location permission denied'));
    renderGate(true);
    await waitFor(() => expect(screen.getByRole('button', { name: /use current location/i })).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /use current location/i }));
    });
    await waitFor(() => expect(screen.getByText(/permission denied/i)).toBeTruthy());
    expect(screen.queryByTestId('home-content')).toBeNull();
    expect(screen.getByRole('button', { name: /enter manually/i })).toBeTruthy();
  });

  it('stays on the gate when GPS is unavailable', async () => {
    fillAddressFromCurrentLocation.mockRejectedValue(new Error('Location unavailable'));
    renderGate(true);
    await waitFor(() => expect(screen.getByRole('button', { name: /use current location/i })).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /use current location/i }));
    });
    await waitFor(() => expect(screen.getByText(/unavailable/i)).toBeTruthy());
    expect(screen.queryByTestId('home-content')).toBeNull();
  });

  it('stays on the gate when reverse geocoding fails', async () => {
    fillAddressFromCurrentLocation.mockRejectedValue(new Error('Could not detect location'));
    renderGate(true);
    await waitFor(() => expect(screen.getByRole('button', { name: /use current location/i })).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /use current location/i }));
    });
    await waitFor(() => expect(screen.getByText(/could not detect location/i)).toBeTruthy());
    expect(screen.queryByTestId('home-content')).toBeNull();
  });

  it('opens the existing manual picker and returns to the gate on Back', async () => {
    renderGate(true);
    await waitFor(() => expect(screen.getByRole('button', { name: /enter manually/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /enter manually/i }));
    expect(screen.getByText('Set your location')).toBeTruthy();
    expect(screen.queryByLabelText(/close/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByText('Choose your location')).toBeTruthy();
    expect(screen.queryByTestId('home-content')).toBeNull();
  });

  it('does not bypass the gate when the mandatory manual backdrop is clicked', async () => {
    renderGate(true);
    await waitFor(() => expect(screen.getByRole('button', { name: /enter manually/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /enter manually/i }));
    fireEvent.click(screen.getByTestId('manual-location-backdrop'));
    expect(screen.getByText('Set your location')).toBeTruthy();
    expect(screen.queryByTestId('home-content')).toBeNull();
  });

  it('unlocks Home after a valid known-city manual selection', async () => {
    renderGate(true);
    await waitFor(() => expect(screen.getByRole('button', { name: /enter manually/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /enter manually/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Bangalore'), { target: { value: 'Bangalore' } });
    fireEvent.click(screen.getByRole('button', { name: /use this location/i }));
    await waitFor(() => expect(screen.getByTestId('home-content')).toBeTruthy());
  });

  it('keeps Home blocked for an unknown city without coordinates', async () => {
    renderGate(true);
    await waitFor(() => expect(screen.getByRole('button', { name: /enter manually/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /enter manually/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Bangalore'), { target: { value: 'Unknownville' } });
    fireEvent.click(screen.getByRole('button', { name: /use this location/i }));
    expect(screen.getByText(/choose a city we can locate/i)).toBeTruthy();
    expect(screen.queryByTestId('home-content')).toBeNull();
  });

  it('does not block authenticated Home without location', async () => {
    renderGate(false);
    await waitFor(() => expect(screen.getByTestId('home-content')).toBeTruthy());
    expect(screen.queryByText('Choose your location')).toBeNull();
  });

  it('does not globally wrap Providers or WPay/Ecommerce routes', () => {
    const providers = fs.readFileSync(path.join(CUSTOMER_WEB_ROOT, 'app/providers.tsx'), 'utf8');
    expect(providers).not.toMatch(/GuestLocationPrompt/);
    expect(providers).not.toMatch(/GuestHomeLocationGateHost/);

    const wpay = fs.readFileSync(path.join(CUSTOMER_WEB_ROOT, 'app/warmpawz-pay/page.tsx'), 'utf8');
    expect(wpay).not.toMatch(/GuestHomeLocationGateHost/);

    const shop = fs.readFileSync(path.join(CUSTOMER_WEB_ROOT, 'app/shop/page.tsx'), 'utf8');
    expect(shop).not.toMatch(/GuestHomeLocationGateHost/);

    const wrapper = fs.readFileSync(
      path.join(CUSTOMER_WEB_ROOT, 'components/customer/wrappers/CustomerHomeWrapper.tsx'),
      'utf8'
    );
    expect(wrapper).toMatch(/GuestHomeLocationGateHost/);
    expect(wrapper).toMatch(/currentScreen === 'home'/);
  });

  it('does not keep a Not now dismiss bypass in the Guest Home prompt', () => {
    const src = fs.readFileSync(
      path.join(CUSTOMER_WEB_ROOT, 'components/customer/GuestLocationPrompt.tsx'),
      'utf8'
    );
    expect(src).not.toMatch(/Not now/);
    expect(src).not.toMatch(/sessionStorage\.setItem\(LEGACY_PROMPT_DISMISSED_KEY/);
  });
});

describe('GuestLocationPrompt actions', () => {
  beforeEach(() => {
    localStorage.clear();
    fillAddressFromCurrentLocation.mockReset();
  });

  it('exposes only Use Current Location and Enter Manually', async () => {
    render(
      createElement(LocationProvider, null, createElement(GuestLocationPrompt))
    );
    await waitFor(() => expect(screen.getByText('Choose your location')).toBeTruthy());
    expect(screen.getAllByRole('button').map((el) => el.textContent)).toEqual([
      'Use Current Location',
      'Enter Manually',
    ]);
  });
});
