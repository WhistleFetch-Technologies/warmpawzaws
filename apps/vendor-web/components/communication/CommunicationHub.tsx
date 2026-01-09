"use client";

interface CommunicationHubProps {
  mode?: 'video' | 'chat';
  bookingId: string;
  userId?: string;
  userName?: string;
  otherUserName?: string;
  userType?: string;
  onClose?: () => void;
}

export function CommunicationHub({ mode, bookingId, userId, userName, otherUserName, userType, onClose }: CommunicationHubProps) {
  // Placeholder component - to be implemented with full communication hub
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="p-6">
          <h3 className="text-lg font-bold mb-4">Communication Hub</h3>
          <p className="text-gray-600 mb-4">Mode: {mode}</p>
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Close</button>
        </div>
      </div>
    </div>
  );
}
