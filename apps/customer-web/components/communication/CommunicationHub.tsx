"use client";

import { useState } from 'react';

interface CommunicationHubProps {
  mode?: 'video' | 'chat';
  bookingId: string;
  vendorId?: string;
  customerId?: string;
  userId?: string;
  userName?: string;
  otherUserName?: string;
  userType?: string;
  onClose?: () => void;
  onBookFollowUp?: () => void;
}

export function CommunicationHub({ 
  mode, 
  bookingId, 
  vendorId, 
  customerId, 
  userId, 
  userName, 
  otherUserName, 
  userType, 
  onClose,
  onBookFollowUp
}: CommunicationHubProps) {
  // Placeholder component - to be implemented with actual communication features
  return (
    <div className="w-full p-4 bg-gray-50 rounded-lg">
      <p className="text-gray-500">Communication hub coming soon</p>
      {onClose && (
        <button onClick={onClose} className="mt-2 text-sm text-blue-600">Close</button>
      )}
    </div>
  );
}

