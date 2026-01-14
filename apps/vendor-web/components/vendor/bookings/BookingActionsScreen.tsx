'use client';

/**
 * Booking Actions Screen (web)
 * Simplified cards for common booking actions
 */

import React from 'react';

interface BookingActionsScreenProps {
  bookingId: string;
  vendorId: string;
  bookingData?: any;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function BookingActionsScreen({
  bookingId,
  vendorId,
  bookingData,
  onBack,
  onNavigate,
}: BookingActionsScreenProps) {
  const handleAction = (action: string) => {
    onNavigate?.(action, { bookingId, vendorId, bookingData });
  };

  const actions = [
    { id: 'detail', label: 'View Details', icon: '📋', screen: 'BookingDetail' },
    { id: 'assign-staff', label: 'Assign Staff', icon: '👥', screen: 'StaffAssignment' },
    { id: 'start-service', label: 'Start Service', icon: '▶️', screen: 'StartService' },
    { id: 'upload-file', label: 'Upload Prescription', icon: '📄', screen: 'FileUpload' },
    { id: 'complete', label: 'Complete Booking', icon: '✓', screen: 'BookingCompletion' },
  ].filter((action) => action);

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
          <h1 className="text-xl font-bold text-gray-900">Booking Actions</h1>
          {bookingData && (
            <p className="text-sm text-gray-500 mt-1">
              Booking ID: {bookingId} • Status: {bookingData.status}
            </p>
          )}
        </div>

        <div className="px-4 py-6 space-y-3">
          {actions.map((action) => (
            <button
              key={action.id}
              className="w-full bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:border-orange-300 hover:shadow-sm transition-colors"
              onClick={() => handleAction(action.screen)}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{action.icon}</span>
                <span className="text-gray-900 font-medium">{action.label}</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
          ))}

          {actions.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-gray-500">No actions available for this booking</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

