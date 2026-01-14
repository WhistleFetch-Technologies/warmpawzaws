'use client';

import React from 'react';

interface BookingDetailScreenProps {
  bookingId: string;
  vendorId?: string;
  bookingData?: any;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

/**
 * Minimal booking detail view for web
 * Displays key booking info and provides navigation hooks
 */
export function BookingDetailScreen({
  bookingId,
  vendorId,
  bookingData,
  onBack,
  onNavigate,
}: BookingDetailScreenProps) {
  const data = bookingData || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          {onBack && (
            <button
              onClick={onBack}
              className="text-orange-500 text-sm font-medium mb-2"
            >
              ← Back
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900">Booking Details</h1>
          <p className="text-sm text-gray-500 mt-1">Booking ID: {bookingId}</p>
          {vendorId && <p className="text-xs text-gray-400">Vendor: {vendorId}</p>}
        </div>

        <div className="px-4 py-6 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="text-gray-900 font-semibold">
              {data.serviceName || 'Service'}
            </p>
            <p className="text-sm text-gray-500">
              Status: {data.status || 'N/A'}
            </p>
            {data.customerName && (
              <p className="text-sm text-gray-500">Customer: {data.customerName}</p>
            )}
            {data.bookingDate && (
              <p className="text-sm text-gray-500">Date: {data.bookingDate}</p>
            )}
            {data.bookingTime && (
              <p className="text-sm text-gray-500">Time: {data.bookingTime}</p>
            )}
          </div>

          <div className="space-y-2">
            <button
              className="w-full bg-orange-500 text-white py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors"
              onClick={() => onNavigate?.('BookingActions', { bookingId, vendorId, bookingData: data })}
            >
              Manage Actions
            </button>
            <button
              className="w-full border border-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              onClick={() => onNavigate?.('BookingCompletion', { bookingId, vendorId, bookingData: data })}
            >
              Complete Booking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
