'use client';

import { LiveTrackingMap } from '../tracking/LiveTrackingMap';

interface LiveTrackingProps {
  sessionId: string;
  bookingId: string;
  onClose: () => void;
}

export function LiveTracking({ bookingId, onClose }: LiveTrackingProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Live Tracking</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          <LiveTrackingMap
            bookingId={bookingId}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
