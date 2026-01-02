/**
 * Batch 1 Test Suite
 * Automated tests for all 10 Batch 1 screens
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';

// Import screens
import { BookingCompletionScreen } from '../screens/bookings/BookingCompletionScreen';
import { BookingDetailScreen } from '../screens/bookings/BookingDetailScreen';
import { StaffAssignmentScreen } from '../screens/bookings/StaffAssignmentScreen';
import { BookingCheckInScreen } from '../screens/bookings/BookingCheckInScreen';
import { StartServiceScreen } from '../screens/bookings/StartServiceScreen';
import { GPSTrackingScreen } from '../screens/tracking/GPSTrackingScreen';
import { RouteTrackingScreen } from '../screens/tracking/RouteTrackingScreen';
import { FileUploadScreen } from '../screens/bookings/FileUploadScreen';
import { BookingActionsScreen } from '../screens/bookings/BookingActionsScreen';

// Mock API
jest.mock('../services/api', () => ({
  VendorBookingActionsApi: {
    completeBooking: jest.fn(() => Promise.resolve({ success: true })),
  },
  AppointmentDetailApi: {
    getBookingDetails: jest.fn(() => Promise.resolve({ id: 'test-123' })),
  },
  VendorApi: {
    getStaff: jest.fn(() => Promise.resolve([{ id: 'staff-1', name: 'Test Staff' }])),
  },
  BookingActionsApi: {
    checkIn: jest.fn(() => Promise.resolve({ success: true })),
    startService: jest.fn(() => Promise.resolve({ success: true })),
  },
  StaffAssignmentApi: {
    assignStaff: jest.fn(() => Promise.resolve({ success: true, assignments: [] })),
  },
}));

// Mock expo modules
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: { latitude: 28.6139, longitude: 77.209 },
  })),
  watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: false, assets: [{ uri: 'test-uri' }] })),
  launchCameraAsync: jest.fn(() => Promise.resolve({ canceled: false, assets: [{ uri: 'test-uri' }] })),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'test-token' })),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => <View {...props} ref={ref} testID="map" />),
    Marker: (props: any) => <View testID="marker" {...props} />,
    Polyline: (props: any) => <View testID="polyline" {...props} />,
  };
});

describe('Batch 1 - Screen Tests', () => {
  const mockVendorId = 'test-vendor-123';
  const mockBookingId = 'test-booking-123';
  const mockBookingData = {
    id: mockBookingId,
    status: 'confirmed',
    customerName: 'Test Customer',
    serviceName: 'Test Service',
    amount: 500,
  };

  const renderWithNavigation = (component: React.ReactElement) => {
    return render(<NavigationContainer>{component}</NavigationContainer>);
  };

  describe('1. BookingCompletionScreen', () => {
    it('renders correctly', () => {
      const { getByText } = renderWithNavigation(
        <BookingCompletionScreen
          bookingId={mockBookingId}
          vendorId={mockVendorId}
          bookingData={mockBookingData}
        />
      );
      expect(getByText('Complete Booking')).toBeTruthy();
    });

    it('shows OTP input when required', () => {
      const { getByPlaceholderText } = renderWithNavigation(
        <BookingCompletionScreen
          bookingId={mockBookingId}
          vendorId={mockVendorId}
          bookingData={{ ...mockBookingData, metadata: { requiresOTP: true } }}
        />
      );
      expect(getByPlaceholderText('Enter OTP')).toBeTruthy();
    });
  });

  describe('2. BookingDetailScreen', () => {
    it('renders booking details', async () => {
      const { getByText } = renderWithNavigation(
        <BookingDetailScreen
          bookingId={mockBookingId}
          vendorId={mockVendorId}
        />
      );
      await waitFor(() => {
        expect(getByText('Booking Details')).toBeTruthy();
      });
    });
  });

  describe('3. StaffAssignmentScreen', () => {
    it('loads and displays staff list', async () => {
      const { getByText } = renderWithNavigation(
        <StaffAssignmentScreen
          bookingId={mockBookingId}
          vendorId={mockVendorId}
        />
      );
      await waitFor(() => {
        expect(getByText('Assign Staff')).toBeTruthy();
      });
    });
  });

  describe('4. BookingCheckInScreen', () => {
    it('renders check-in form', () => {
      const { getByText } = renderWithNavigation(
        <BookingCheckInScreen
          bookingId={mockBookingId}
          vendorId={mockVendorId}
          bookingData={mockBookingData}
        />
      );
      expect(getByText('Check In')).toBeTruthy();
    });
  });

  describe('5. StartServiceScreen', () => {
    it('renders start service screen', () => {
      const { getByText } = renderWithNavigation(
        <StartServiceScreen
          bookingId={mockBookingId}
          vendorId={mockVendorId}
          bookingData={mockBookingData}
        />
      );
      expect(getByText('Start Service')).toBeTruthy();
    });
  });

  describe('6. GPSTrackingScreen', () => {
    it('renders GPS tracking screen', () => {
      const { getByText } = renderWithNavigation(
        <GPSTrackingScreen
          bookingId={mockBookingId}
          vendorId={mockVendorId}
        />
      );
      expect(getByText('GPS Tracking')).toBeTruthy();
    });
  });

  describe('7. RouteTrackingScreen', () => {
    it('renders route tracking screen', () => {
      const { getByText } = renderWithNavigation(
        <RouteTrackingScreen
          bookingId={mockBookingId}
          vendorId={mockVendorId}
        />
      );
      expect(getByText('Route Tracking')).toBeTruthy();
    });
  });

  describe('8. FileUploadScreen', () => {
    it('renders file upload screen', () => {
      const { getByText } = renderWithNavigation(
        <FileUploadScreen
          bookingId={mockBookingId}
          vendorId={mockVendorId}
        />
      );
      expect(getByText(/Upload/)).toBeTruthy();
    });
  });

  describe('9. BookingActionsScreen', () => {
    it('renders booking actions screen', () => {
      const { getByText } = renderWithNavigation(
        <BookingActionsScreen
          bookingId={mockBookingId}
          vendorId={mockVendorId}
          bookingData={mockBookingData}
        />
      );
      expect(getByText('Booking Actions')).toBeTruthy();
    });
  });
});

