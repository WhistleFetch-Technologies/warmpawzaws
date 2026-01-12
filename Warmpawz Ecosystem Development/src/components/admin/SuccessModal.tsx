import { X, Check } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
  title?: string;
}

export function SuccessModal({ isOpen, onClose, message = 'Renewal Sent!', title }: SuccessModalProps) {
  if (!isOpen) return null;

  // Auto-close after 2 seconds
  setTimeout(() => {
    onClose();
  }, 2000);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[400px] mx-4 p-8">
        <div className="flex flex-col items-center justify-center text-center">
          {/* Success Icon */}
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <Check className="w-12 h-12 text-white" strokeWidth={3} />
          </div>

          {/* Message */}
          <h2 className="text-xl text-green-600 mb-2">{message}</h2>
          {title && <p className="text-sm text-gray-600">{title}</p>}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>
    </div>
  );
}
