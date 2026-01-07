'use client';

import React, { useState } from 'react';
import { FileText, Plus, Save, Loader2 } from 'lucide-react';

interface EnhancedOnboardingFormBuilderProps {
  onBack?: () => void;
}

export function EnhancedOnboardingFormBuilder({ onBack }: EnhancedOnboardingFormBuilderProps) {
  const [saving, setSaving] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          {onBack && (
            <button
              onClick={onBack}
              className="mb-0 text-gray-600 hover:text-gray-900 flex items-center gap-0"
            >
              ← Back
            </button>
          )}
          <div className="flex items-center gap-0">
            <div className="p-0 bg-orange-100 rounded-lg">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Form Builder</h1>
              <p className="text-sm text-gray-500">Build custom onboarding forms</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-lg border-2 border-gray-200 p-8 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-0" />
          <p className="text-gray-500 mb-4">Form builder interface coming soon</p>
          <button className="px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-0 mx-auto">
            <Plus className="w-4 h-4" />
            Add Field
          </button>
        </div>
      </div>
    </div>
  );
}

