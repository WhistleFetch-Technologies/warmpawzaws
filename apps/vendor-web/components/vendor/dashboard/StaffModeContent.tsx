'use client';

import React from 'react';
import { User, Calendar, CheckCircle } from 'lucide-react';

interface StaffModeContentProps {
  session: any;
  staff: any;
  center: any;
  isSoloProvider: boolean;
  onRefresh: () => void;
}

export function StaffModeContent({ 
  session, 
  staff, 
  center, 
  isSoloProvider,
  onRefresh 
}: StaffModeContentProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-6 h-6 text-orange-600" />
          <h2 className="text-lg font-semibold text-gray-900">Staff Mode</h2>
        </div>
        <p className="text-sm text-gray-600">
          View your assigned tasks, schedule, and personal performance metrics.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <Calendar className="w-5 h-5 text-orange-600 mb-0" />
          <div className="text-2xl font-bold text-gray-900">0</div>
          <div className="text-xs text-gray-500">My Appointments</div>
        </div>
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <CheckCircle className="w-5 h-5 text-orange-600 mb-0" />
          <div className="text-2xl font-bold text-gray-900">0</div>
          <div className="text-xs text-gray-500">Completed</div>
        </div>
      </div>

      {isSoloProvider && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> In Staff mode, you see your personal schedule and tasks. Switch to Center mode to manage the overall business.
          </p>
        </div>
      )}
    </div>
  );
}

