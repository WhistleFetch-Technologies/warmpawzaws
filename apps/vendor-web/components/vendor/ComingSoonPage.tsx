'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';

export interface ComingSoonPageProps {
  title: string;
  description: string;
  icon: string;
  expectedDate?: string;
  features?: string[];
}

export function ComingSoonPage({ 
  title, 
  description, 
  icon, 
  expectedDate,
  features = []
}: ComingSoonPageProps) {
  const [email, setEmail] = useState('');
  const [notifyRequested, setNotifyRequested] = useState(false);

  const handleNotifyMe = async () => {
    if (!email) {
      toast.error('Please enter your email');
      return;
    }
    
    // TODO: Connect to actual notification system
    console.log(`Notification requested for ${title} by ${email}`);
    setNotifyRequested(true);
    toast.success('You\'ll be notified when this feature launches!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-8 text-center">
          <div className="text-7xl mb-4 animate-bounce">{icon}</div>
          <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
          <p className="text-orange-100">{description}</p>
        </div>
        
        {/* Content */}
        <div className="p-8">
          {/* Status Badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center px-6 py-3 bg-orange-100 text-orange-600 rounded-full text-lg font-medium">
              <span className="animate-pulse mr-2 text-2xl">🚧</span>
              Coming Soon{expectedDate ? ` • ${expectedDate}` : ''}
            </div>
          </div>
          
          {/* Features List */}
          {features.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                What to expect:
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-green-500 mt-1">✓</span>
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Notification Form */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Get Notified
              </h3>
              <p className="text-sm text-gray-600">
                We'll send you an email when this feature is ready to use
              </p>
            </div>
            
            {!notifyRequested ? (
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  onClick={handleNotifyMe}
                  className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium whitespace-nowrap"
                >
                  Notify Me
                </button>
              </div>
            ) : (
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <span className="text-2xl mb-2 block">✅</span>
                <p className="text-green-700 font-medium">
                  You're on the list! We'll notify you at {email}
                </p>
              </div>
            )}
          </div>
          
          {/* Additional Info */}
          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500 mb-4">
              This feature is currently under development
            </p>
            <div className="flex justify-center gap-4">
              <a 
                href="/dashboard" 
                className="text-orange-500 hover:text-orange-600 font-medium text-sm"
              >
                ← Back to Dashboard
              </a>
              <a 
                href="/support" 
                className="text-gray-500 hover:text-gray-700 font-medium text-sm"
              >
                Contact Support →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Preset configurations for common coming soon pages
export const comingSoonPresets = {
  vaccination: {
    title: 'Vaccination Records',
    description: 'Complete vaccination management system',
    icon: '💉',
    expectedDate: 'Q1 2026',
    features: [
      'Track all pet vaccinations',
      'Set automatic reminders',
      'Generate vaccination certificates',
      'Maintain complete history',
    ],
  },
  patient_monitoring: {
    title: 'Patient Monitoring',
    description: 'Real-time patient vitals and health tracking',
    icon: '❤️',
    expectedDate: 'Q1 2026',
    features: [
      'Real-time vital signs tracking',
      'Automated alerts for critical values',
      'Visual health trend charts',
      'Comprehensive monitoring history',
    ],
  },
  cctv_access: {
    title: 'CCTV Access',
    description: 'Live camera feeds for boarding customers',
    icon: '📹',
    expectedDate: 'Q1 2026',
    features: [
      'Manage multiple cameras',
      'Generate secure access links',
      'Time-limited customer access',
      'Recorded footage management',
    ],
  },
  emergency_protocols: {
    title: 'Emergency Protocols',
    description: 'Emergency response and protocol management',
    icon: '🚨',
    expectedDate: 'Q1 2026',
    features: [
      'Pre-defined emergency protocols',
      'Quick access contact lists',
      'Incident reporting and logging',
      'Staff training checklists',
    ],
  },
  controlled_substances: {
    title: 'Controlled Substances',
    description: 'Manage controlled medications and compliance',
    icon: '🔒',
    expectedDate: 'Q1 2026',
    features: [
      'Track controlled medication inventory',
      'Maintain dispensing logs',
      'Regulatory compliance reports',
      'Secure access controls',
    ],
  },
  memorial: {
    title: 'Memorial Services',
    description: 'Pet memorial and remembrance services',
    icon: '🕯️',
    expectedDate: 'Q2 2026',
    features: [
      'Memorial service packages',
      'Digital remembrance profiles',
      'Cremation/burial tracking',
      'Keepsake management',
    ],
  },
  counseling: {
    title: 'Counseling Services',
    description: 'Pet behavior counseling and grief support',
    icon: '💬',
    expectedDate: 'Q2 2026',
    features: [
      'Session scheduling and notes',
      'Progress tracking',
      'Resource library',
      'Client communication tools',
    ],
  },
  vet_summary: {
    title: 'Veterinary Summary',
    description: 'Comprehensive patient summaries and reports',
    icon: '📋',
    expectedDate: 'Q1 2026',
    features: [
      'Auto-generated patient summaries',
      'Treatment history reports',
      'Exportable medical records',
      'Customizable report templates',
    ],
  },
  facility_management: {
    title: 'Facility Management',
    description: 'Complete facility and amenities management',
    icon: '🏢',
    expectedDate: 'Q1 2026',
    features: [
      'Location and address management',
      'Operating hours configuration',
      'Amenities and features list',
      'Facility photo gallery',
    ],
  },
};
