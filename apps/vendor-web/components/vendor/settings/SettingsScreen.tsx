'use client';

import React from 'react';

interface SettingsScreenProps {
  vendorId: string;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

type SettingsItem = { id: string; label: string; icon: string; screen: string; danger?: boolean };
type SettingsSection = { title: string; items: SettingsItem[] };

/**
 * Simplified settings screen for web
 */
export function SettingsScreen({ vendorId, onBack, onNavigate }: SettingsScreenProps) {
  const sections: SettingsSection[] = [
    {
      title: 'Account',
      items: [
        { id: 'profile', label: 'Profile', icon: '👤', screen: 'Profile' },
        { id: 'security', label: 'Security', icon: '🔒', screen: 'Security' },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { id: 'notifications', label: 'Notifications', icon: '🔔', screen: 'NotificationsSettings' },
      ],
    },
    {
      title: 'Support',
      items: [
        { id: 'help', label: 'Help & Support', icon: '❓', screen: 'Help' },
      ],
    },
    {
      title: 'Account Actions',
      items: [{ id: 'logout', label: 'Logout', icon: '🚪', screen: 'Logout', danger: true }],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          {onBack && (
            <button
              onClick={onBack}
              className="text-orange-500 text-sm font-medium mb-2"
            >
              ← Back
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-400">Vendor ID: {vendorId}</p>
        </div>

        <div className="px-4 py-6 space-y-6">
          {sections.map((section) => (
            <div key={section.title} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    onClick={() => onNavigate?.(item.screen, { vendorId })}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">{item.icon}</span>
                      <span className={`text-sm ${item.danger ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                        {item.label}
                      </span>
                    </div>
                    <span className="text-gray-400">→</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
