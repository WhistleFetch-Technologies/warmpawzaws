'use client';

import React from 'react';
import { Building2, Calendar, DollarSign, Users } from 'lucide-react';

interface CenterModeContentProps {
  session: any;
  vendor: any;
  center: any;
  isSoloProvider: boolean;
  onRefresh: () => void;
}

export function CenterModeContent({ 
  session, 
  vendor, 
  center, 
  isSoloProvider,
  onRefresh 
}: CenterModeContentProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
        <div className="flex items-center gap-0 mb-4">
          <Building2 className="w-6 h-6 text-orange-600" />
          <h2 className="text-lg font-semibold text-gray-900">Center Mode</h2>
        </div>
        <p className="text-sm text-gray-600">
          Manage your center operations, bookings, and services from this view.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <Calendar className="w-5 h-5 text-orange-600 mb-0" />
          <div className="text-2xl font-bold text-gray-900">0</div>
          <div className="text-xs text-gray-500">Today's Bookings</div>
        </div>
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <DollarSign className="w-5 h-5 text-orange-600 mb-0" />
          <div className="text-2xl font-bold text-gray-900">₹0</div>
          <div className="text-xs text-gray-500">Today's Revenue</div>
        </div>
      </div>

      {isSoloProvider && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> As a solo provider, you can switch between Center and Staff modes to manage different aspects of your business.
          </p>
        </div>
      )}
    </div>
  );
}

