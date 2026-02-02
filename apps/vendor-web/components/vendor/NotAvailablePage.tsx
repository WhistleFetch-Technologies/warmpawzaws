'use client';

import React from 'react';
import Link from 'next/link';

export interface NotAvailablePageProps {
  title: string;
  description?: string;
  icon?: string;
}

export function NotAvailablePage({ title, description, icon = '📋' }: NotAvailablePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden text-center p-8">
        <div className="text-5xl mb-4">{icon}</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">{title}</h1>
        {description && <p className="text-gray-600 text-sm mb-6">{description}</p>}
        <p className="text-gray-500 text-sm mb-6">This section is not available.</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium text-sm"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

export const notAvailablePresets: Record<string, NotAvailablePageProps> = {
  memorial: { title: 'Memorial Services', description: 'Pet memorial and remembrance', icon: '🕯️' },
  facility_management: { title: 'Facility Management', description: 'Facility and amenities', icon: '🏢' },
  emergency_protocols: { title: 'Emergency Protocols', description: 'Emergency response', icon: '🚨' },
  counseling: { title: 'Counseling Services', description: 'Behavior and grief support', icon: '💬' },
  cctv_access: { title: 'CCTV Access', description: 'Live camera feeds', icon: '📹' },
  controlled_substances: { title: 'Controlled Substances', description: 'Controlled medications', icon: '🔒' },
  vet_summary: { title: 'Veterinary Summary', description: 'Patient summaries', icon: '📋' },
  patient_monitoring: { title: 'Patient Monitoring', description: 'Vitals and health tracking', icon: '❤️' },
};
