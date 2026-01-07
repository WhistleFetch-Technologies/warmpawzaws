'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';

interface VendorApprovalSuccessProps {
  vendorId: string;
  vendorType: string;
  serviceStyle: 'at_home' | 'at_center' | 'both';
  onSetupComplete: () => void;
}

export function VendorApprovalSuccessNew({ 
  vendorId, 
  onSetupComplete 
}: VendorApprovalSuccessProps) {
  const [loading, setLoading] = useState(false);

  const handleGetStarted = async () => {
    setLoading(true);
    try {
      const response = await apiClient.post<any>('/vendor/setup/complete', {
        vendorId,
        setupCompleted: true,
      });

      if (response.success) {
        setTimeout(() => onSetupComplete(), 1000);
      } else {
        alert('Failed to complete setup');
      }
    } catch (error) {
      console.error('Error completing setup:', error);
      alert('Error completing setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex flex-col items-center justify-center px-0">
      <div className="flex flex-col items-center mb-8">
        <div className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center shadow-2xl mb-0">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center">
            <CheckCircle className="w-16 h-16 text-green-500" strokeWidth={3} />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
          🎉 You're<br/>Approved!
        </h1>

        <div className="text-center mb-0">
          <p className="text-lg text-gray-800 mb-0">
            Welcome to WARMPAWZ! Set up<br/>your services to start earning
          </p>
          <p className="text-base text-green-600 font-semibold">
            Your profile is now live and visible to pet parents
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 p-0 mb-8 w-full">
        <div className="space-y-4">
          <div className="flex items-start gap-0">
            <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0 mt-0">
              <span className="text-white font-bold text-sm">1</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-0">Complete Your Dashboard Setup</h3>
              <p className="text-sm text-gray-600">Add your services, set pricing, and configure availability</p>
            </div>
          </div>
          
          <div className="flex items-start gap-0">
            <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0 mt-0">
              <span className="text-white font-bold text-sm">2</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-0">Start Receiving Bookings</h3>
              <p className="text-sm text-gray-600">Pet parents can now find and book your services</p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleGetStarted}
        disabled={loading}
        className="w-full py-4 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-semibold flex items-center justify-center gap-0 disabled:opacity-50"
      >
        {loading ? (
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
  );
}

