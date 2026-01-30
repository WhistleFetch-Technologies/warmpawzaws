'use client';

import React from 'react';
import { 
  User, 
  Shield, 
  Bell, 
  HelpCircle, 
  LogOut, 
  ChevronRight,
  Settings,
  CreditCard,
  Clock,
  MapPin,
  FileText,
  ArrowLeft
} from 'lucide-react';

interface SettingsScreenProps {
  vendorId: string;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

type SettingsItem = { 
  id: string; 
  label: string; 
  description?: string;
  icon: React.ElementType; 
  screen: string; 
  danger?: boolean;
  iconBg?: string;
  iconColor?: string;
};
type SettingsSection = { title: string; items: SettingsItem[] };

/**
 * Enhanced settings screen with modern UI
 */
export function SettingsScreen({ vendorId, onBack, onNavigate }: SettingsScreenProps) {
  const sections: SettingsSection[] = [
    {
      title: 'Account',
      items: [
        { 
          id: 'profile', 
          label: 'Profile Settings', 
          description: 'Manage your business profile',
          icon: User, 
          screen: 'Profile',
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600'
        },
        { 
          id: 'security', 
          label: 'Security', 
          description: 'Password and authentication',
          icon: Shield, 
          screen: 'Security',
          iconBg: 'bg-green-100',
          iconColor: 'text-green-600'
        },
        { 
          id: 'payments', 
          label: 'Payment Settings', 
          description: 'Bank account and payouts',
          icon: CreditCard, 
          screen: 'Payments',
          iconBg: 'bg-purple-100',
          iconColor: 'text-purple-600'
        },
      ],
    },
    {
      title: 'Business Settings',
      items: [
        { 
          id: 'availability', 
          label: 'Availability', 
          description: 'Working hours and schedule',
          icon: Clock, 
          screen: 'Availability',
          iconBg: 'bg-orange-100',
          iconColor: 'text-orange-600'
        },
        { 
          id: 'service-area', 
          label: 'Service Area', 
          description: 'Coverage and locations',
          icon: MapPin, 
          screen: 'ServiceArea',
          iconBg: 'bg-teal-100',
          iconColor: 'text-teal-600'
        },
        { 
          id: 'documents', 
          label: 'Documents', 
          description: 'Licenses and certifications',
          icon: FileText, 
          screen: 'Documents',
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600'
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { 
          id: 'notifications', 
          label: 'Notifications', 
          description: 'Alerts and reminders',
          icon: Bell, 
          screen: 'NotificationsSettings',
          iconBg: 'bg-pink-100',
          iconColor: 'text-pink-600'
        },
        { 
          id: 'general', 
          label: 'General Settings', 
          description: 'App preferences',
          icon: Settings, 
          screen: 'General',
          iconBg: 'bg-gray-100',
          iconColor: 'text-gray-600'
        },
      ],
    },
    {
      title: 'Support',
      items: [
        { 
          id: 'help', 
          label: 'Help & Support', 
          description: 'FAQs and contact support',
          icon: HelpCircle, 
          screen: 'Help',
          iconBg: 'bg-indigo-100',
          iconColor: 'text-indigo-600'
        },
      ],
    },
    {
      title: 'Account Actions',
      items: [
        { 
          id: 'logout', 
          label: 'Logout', 
          description: 'Sign out of your account',
          icon: LogOut, 
          screen: 'Logout', 
          danger: true,
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600'
        }
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="px-4 py-4">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <div className="flex-1">
                <h1 className="text-xl font-bold text-gray-900">Settings</h1>
                <p className="text-xs text-gray-500 mt-0.5">Manage your vendor account</p>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="px-4 py-6 space-y-6">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-3">
                {section.title}
              </h3>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {section.items.map((item, index) => {
                  const IconComponent = item.icon;
                  return (
                    <button
                      key={item.id}
                      className={`w-full px-4 py-4 flex items-center gap-4 hover:bg-gray-50 transition-all active:bg-gray-100 ${
                        index !== section.items.length - 1 ? 'border-b border-gray-100' : ''
                      }`}
                      onClick={() => onNavigate?.(item.screen, { vendorId })}
                    >
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-xl ${item.iconBg || 'bg-gray-100'} flex items-center justify-center flex-shrink-0`}>
                        <IconComponent className={`w-5 h-5 ${item.iconColor || 'text-gray-600'}`} />
                      </div>
                      
                      {/* Label & Description */}
                      <div className="flex-1 text-left">
                        <p className={`font-medium ${item.danger ? 'text-red-600' : 'text-gray-900'}`}>
                          {item.label}
                        </p>
                        {item.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                        )}
                      </div>
                      
                      {/* Arrow */}
                      <ChevronRight className={`w-5 h-5 ${item.danger ? 'text-red-400' : 'text-gray-300'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          
          {/* Footer */}
          <div className="text-center py-4">
            <p className="text-xs text-gray-400">
              Warmpawz Vendor App v1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
