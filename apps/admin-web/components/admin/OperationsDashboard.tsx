'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Activity, ArrowLeft, Loader2 } from 'lucide-react';
import { SystemHealthTab } from './operations/SystemHealthTab';

interface OperationsDashboardProps {
  onBack?: () => void;
}

export function OperationsDashboard({ onBack }: OperationsDashboardProps) {
  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          {onBack && (
            <button onClick={onBack} className="mb-0 text-gray-600 hover:text-gray-900 flex items-center gap-3">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="p-0 bg-orange-100 rounded-lg">
              <Activity className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Operations</h1>
              <p className="text-sm text-gray-500">System monitoring</p>
            </div>
          </div>
        </div>
      </div>
      <div className="p-4">
        <SystemHealthTab />
      </div>
    </div>
  );
}

