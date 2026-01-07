'use client';

import React from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';

interface VendorSetupCompletedProps {
  onContinue: () => void;
}

export function VendorSetupCompleted({ onContinue }: VendorSetupCompletedProps) {
  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center mb-8">
        <div className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center shadow-2xl mb-6">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center">
            <CheckCircle className="w-16 h-16 text-green-500" strokeWidth={3} />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
          Setup<br/>Complete!
        </h1>

        <div className="text-center mb-6">
          <p className="text-lg text-gray-800 mb-3">
            🎉 Congratulations!<br/>Your vendor profile is ready
          </p>
          <p className="text-base text-green-600 font-semibold">
            You can now start receiving bookings from pet parents
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 p-6 mb-8 w-full">
        <h3 className="font-semibold text-gray-900 mb-4">What you can do now:</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Manage Bookings</p>
              <p className="text-sm text-gray-600">View and manage incoming booking requests</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Update Services</p>
              <p className="text-sm text-gray-600">Add or modify your service offerings anytime</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Track Earnings</p>
              <p className="text-sm text-gray-600">Monitor your revenue and settlements</p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onContinue}
        className="w-full py-4 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-semibold flex items-center justify-center gap-2"
      >
        Go to Dashboard
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}

