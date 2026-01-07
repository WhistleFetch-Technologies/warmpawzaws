'use client';

import React from 'react';
import { HelpCircle, BookOpen, MessageCircle, Phone } from 'lucide-react';

interface SoloProviderHelpersProps {
  onHelp?: () => void;
  onDocs?: () => void;
  onSupport?: () => void;
}

export function SoloProviderHelpers({ onHelp, onDocs, onSupport }: SoloProviderHelpersProps) {
  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-0">Need Help?</h3>
      <div className="space-y-2">
        <button
          onClick={onHelp}
          className="w-full flex items-center gap-0 p-0 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <HelpCircle className="w-5 h-5 text-orange-600" />
          <span className="text-sm text-gray-700">Help Center</span>
        </button>
        <button
          onClick={onDocs}
          className="w-full flex items-center gap-0 p-0 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <BookOpen className="w-5 h-5 text-orange-600" />
          <span className="text-sm text-gray-700">Documentation</span>
        </button>
        <button
          onClick={onSupport}
          className="w-full flex items-center gap-0 p-0 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <MessageCircle className="w-5 h-5 text-orange-600" />
          <span className="text-sm text-gray-700">Contact Support</span>
        </button>
      </div>
    </div>
  );
}

