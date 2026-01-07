'use client';

import React from 'react';
import { CheckCircle, X } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export function SuccessModal({ isOpen, title, message, onClose }: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="p-0">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-0">{title}</h3>
            <p className="text-gray-600 mb-0">{message}</p>
            <button
              onClick={onClose}
              className="w-full px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
