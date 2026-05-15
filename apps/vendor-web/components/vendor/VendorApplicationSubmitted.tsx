'use client';

import { CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VendorApplicationSubmittedProps {
  applicationId: string;
  onContinue: () => void;
  onBack?: () => void;
}

export function VendorApplicationSubmitted({ applicationId, onContinue, onBack }: VendorApplicationSubmittedProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
      <div className="vendor-modal-sheet w-full space-y-6 mx-auto">
        {onBack && (
          <div className="flex justify-start pt-2">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full -ml-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
        )}
        {/* Success Icon */}
        <div className="flex justify-center pt-4">
          <div className="w-24 h-24 rounded-full bg-[#FF8C42] flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-white" strokeWidth={3} />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl">
            <span className="font-bold">Application</span>
            <br />
            <span className="font-bold">Submitted !</span>
          </h1>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-3xl p-6 shadow-sm space-y-6">
          {/* Status Message */}
          <div className="text-center">
            <p className="text-gray-700">
              We're reviewing
              <br />
              your application
            </p>
          </div>

          {/* What's Next Section */}
          <div className="bg-orange-50 rounded-2xl p-5 space-y-3">
            <h3 className="text-[#FF8C42] font-semibold">What's Next?</h3>
            
            <div className="space-y-2 text-sm text-[#FF8C42]">
              <p>• Our team will review your application</p>
              <p>• You'll receive an update within 24-48 hours</p>
              <p>• We may contact you for additional information</p>
            </div>
          </div>

          {/* Continue Button */}
          <Button 
            onClick={onContinue}
            className="w-full bg-[#FF8C42] hover:bg-[#ff7a28] text-white h-12 rounded-xl"
          >
            Continue to Dashboard
          </Button>

          {/* Application ID */}
          <div className="text-center space-y-1 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Application ID #{applicationId}
            </p>
            <p className="text-xs text-gray-400">
              Keep this ID for your records
            </p>
          </div>

          {/* Welcome Message */}
          <div className="text-center pt-2">
            <p className="text-sm text-gray-500">
              Welcome to WARMPAWZ Family 🐾
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
