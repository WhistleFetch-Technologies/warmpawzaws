'use client';

import React, { useState } from 'react';
import { Settings, ArrowLeft } from 'lucide-react';
import { GeneralSettingsTab } from './settings/GeneralSettingsTab';
import { NotificationSettingsTab } from './settings/NotificationSettingsTab';
import { IntegrationSettingsTab } from './settings/IntegrationSettingsTab';

interface AdminSettingsProps {
  onBack?: () => void;
}

export function AdminSettings({ onBack }: AdminSettingsProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'integrations'>('general');

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          {onBack && (
            <button onClick={onBack} className="mb-3 text-gray-600 hover:text-gray-900 flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Settings className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-500">Platform configuration</p>
            </div>
          </div>
        </div>
        <div className="flex border-t border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'general' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'notifications' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Notifications
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'integrations' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Integrations
          </button>
        </div>
      </div>
      <div className="p-4">
        {activeTab === 'general' && <GeneralSettingsTab />}
        {activeTab === 'notifications' && <NotificationSettingsTab />}
        {activeTab === 'integrations' && <IntegrationSettingsTab />}
      </div>
    </div>
  );
}

