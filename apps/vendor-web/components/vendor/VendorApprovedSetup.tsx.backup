'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Check, ArrowRight, Loader2 } from 'lucide-react';

interface VendorApprovedSetupProps {
  vendorId: string;
  roleId?: string;
  onComplete: () => void;
}

export function VendorApprovedSetup({ vendorId, roleId, onComplete }: VendorApprovedSetupProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGetStarted = async () => {
    setIsSubmitting(true);

    try {
      const response = await apiClient.post<any>('/vendor/setup/complete', {
        vendorId,
        setupCompleted: true,
      });

      if (response.success) {
        setTimeout(() => onComplete(), 800);
      } else {
        alert('Failed to proceed. Please try again.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error completing setup:', error);
      alert('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto p-4 flex items-center justify-center">
      <div className="w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-28 h-28 bg-green-500 rounded-full flex items-center justify-center shadow-xl">
              <div className="w-20 h-20 border-4 border-white rounded-full flex items-center justify-center">
                <Check className="w-10 h-10 text-white" strokeWidth={4} />
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl">🎉</span>
            <h1 className="text-3xl font-bold text-gray-900">You're</h1>
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Approved!</h1>
          
          <div className="space-y-1">
            <p className="text-lg text-gray-700 font-medium">Welcome to WARMPAWZ!</p>
            <p className="text-gray-600">Your application has been verified.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border-2 border-gray-200">
          <h3 className="font-bold text-gray-900 text-lg mb-4 text-center">What happens next?</h3>
          
          <div className="space-y-5">
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1 text-orange-600 font-bold">1</div>
              <div>
                <h4 className="font-semibold text-gray-900">Access your Dashboard</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Get full access to manage your business, staff, and appointments.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1 text-orange-600 font-bold">2</div>
              <div>
                <h4 className="font-semibold text-gray-900">Configure Your Services</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Set up your service offerings, pricing, and availability.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1 text-orange-600 font-bold">3</div>
              <div>
                <h4 className="font-semibold text-gray-900">Start Receiving Bookings</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Once configured, customers can find and book your services.
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleGetStarted}
          disabled={isSubmitting}
          className="w-full py-4 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              Get Started
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

