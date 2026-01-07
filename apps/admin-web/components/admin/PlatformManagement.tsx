'use client';

import React, { useState } from 'react';
import { Settings, Cloud, Flag } from 'lucide-react';
import { PlatformSettingsTab } from './platform/PlatformSettingsTab';
import { FeatureFlagsTab } from './platform/FeatureFlagsTab';

interface PlatformManagementProps {
  onBack?: () => void;
}

export function PlatformManagement({ onBack }: PlatformManagementProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'features'>('settings');

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
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
              <Settings className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Platform Management</h1>
              <p className="text-sm text-gray-500">Configure platform settings and features</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-200">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 px-4 py-0 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-0">
              <Cloud className="w-4 h-4" />
              <span>Settings</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('features')}
            className={`flex-1 px-4 py-0 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'features'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-0">
              <Flag className="w-4 h-4" />
              <span>Features</span>
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'settings' && <PlatformSettingsTab />}
        {activeTab === 'features' && <FeatureFlagsTab />}
      </div>
    </div>
  );
}

