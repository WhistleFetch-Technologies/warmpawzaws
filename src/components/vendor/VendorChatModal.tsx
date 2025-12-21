import { X } from 'lucide-react';
import { VendorChatInterface } from './chat/VendorChatInterface';

interface VendorChatModalProps {
  bookingId: string;
  vendorPhone: string;
  vendorName: string;
  customerPhone: string;
  customerName: string;
  petName?: string;
  onClose: () => void;
}

export function VendorChatModal({
  bookingId,
  vendorPhone,
  vendorName,
  customerPhone,
  customerName,
  petName = '',
  onClose
}: VendorChatModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[90vh] flex flex-col shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Chat with {customerName}</h2>
            <p className="text-sm text-gray-500">Booking ID: {bookingId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close chat"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 overflow-hidden">
          <VendorChatInterface
            vendorPhone={vendorPhone}
            vendorName={vendorName}
            bookingId={bookingId}
            customerName={customerName}
            petName={petName}
            onBack={onClose}
          />
        </div>
      </div>
    </div>
  );
}

