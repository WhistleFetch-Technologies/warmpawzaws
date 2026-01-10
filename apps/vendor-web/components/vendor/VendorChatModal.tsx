'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VendorChatModalProps {
  bookingId: string;
  vendorPhone?: string;
  vendorName?: string;
  customerPhone?: string;
  customerName?: string;
  onClose: () => void;
}

export function VendorChatModal({ bookingId, vendorPhone, vendorName, customerPhone, customerName, onClose }: VendorChatModalProps) {
  // Placeholder component - to be implemented with full chat functionality
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Chat with {customerName}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-600">Chat functionality coming soon...</p>
        </div>
      </div>
    </div>
  );
}

