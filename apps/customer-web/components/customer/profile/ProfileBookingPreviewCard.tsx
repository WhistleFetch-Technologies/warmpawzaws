'use client';

import { ChevronRight, Clock } from 'lucide-react';

export interface ProfileBookingPreviewData {
  id: string;
  serviceType: string;
  serviceName?: string;
  vendorName: string;
  startDate: string;
  scheduledDate?: string;
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
  status: 'active' | 'completed' | 'cancelled';
  price: number;
  requiresOTP?: boolean;
  completionOTP?: string;
}

interface ProfileBookingPreviewCardProps {
  booking: ProfileBookingPreviewData;
  onClick?: () => void;
}

export function ProfileBookingPreviewCard({ booking, onClick }: ProfileBookingPreviewCardProps) {
  const serviceLabel = (booking.serviceName ?? booking.serviceType).trim();
  const displayService =
    serviceLabel.charAt(0).toUpperCase() + serviceLabel.slice(1);
  const displayTitle = /\bservice\b/i.test(displayService) || displayService === 'Appointment'
    ? displayService
    : `${displayService} Service`;

  const statusClass =
    booking.status === 'active'
      ? 'bg-green-100 text-green-700'
      : booking.status === 'completed'
        ? 'bg-gray-100 text-gray-700'
        : 'bg-red-100 text-red-700';

  const scheduleDate = booking.startDate || booking.scheduledDate;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50 to-pink-50 p-4 text-left transition-all hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h4 className="mb-1 font-semibold text-gray-800">{displayTitle}</h4>
          <p className="text-sm text-gray-600">{booking.vendorName}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
        </span>
      </div>

      {booking.requiresOTP &&
        booking.completionOTP &&
        booking.status !== 'completed' &&
        booking.status !== 'cancelled' && (
          <div className="mb-3 rounded-lg border border-purple-300 bg-gradient-to-r from-purple-50 to-purple-100 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                🔐 Service OTP
              </span>
            </div>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="text-2xl font-bold tracking-widest text-purple-600">
                {booking.completionOTP}
              </span>
            </div>
            <p className="mt-1 text-center text-xs text-purple-600">
              Share with vendor to complete service
            </p>
          </div>
        )}

      {booking.status === 'active' && booking.totalSessions > 1 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
            <span>
              {booking.completedSessions || 0} of {booking.totalSessions} completed
            </span>
            <span>
              {Math.round(((booking.completedSessions || 0) / booking.totalSessions) * 100)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35]"
              style={{
                width: `${((booking.completedSessions || 0) / booking.totalSessions) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="h-4 w-4" />
          <span>
            {scheduleDate ? new Date(scheduleDate).toLocaleDateString('en-IN') : 'Not scheduled'}
          </span>
        </div>
        <div className="flex items-center gap-1 font-semibold text-[#FF8C42]">
          ₹{booking.price}
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>

      {booking.status === 'active' && booking.upcomingSessions > 0 && (
        <div className="mt-2 inline-block rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700">
          {booking.upcomingSessions} upcoming session{booking.upcomingSessions > 1 ? 's' : ''}
        </div>
      )}
    </button>
  );
}
