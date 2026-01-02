import { CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';

interface VendorApplicationSubmittedProps {
  applicationId: string;
  onContinue: () => void;
}

export function VendorApplicationSubmitted({ applicationId, onContinue }: VendorApplicationSubmittedProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row md:items-center md:justify-center">
      {/* Container for web - max width */}
      <div className="w-full md:max-w-[900px] md:mx-auto md:flex md:shadow-2xl md:rounded-2xl md:overflow-hidden">
        {/* Light Beige/Orange Top Section - Responsive */}
        <div className="bg-gradient-to-b from-orange-50 to-[#FFF5E6] flex-1 flex flex-col items-center justify-center px-6 py-12 md:py-16 md:min-h-[500px] md:max-w-[400px]">
          {/* Success Icon */}
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-[#FF8C42] flex items-center justify-center mb-6 md:mb-8">
            <CheckCircle className="w-12 h-12 md:w-14 md:h-14 text-white" strokeWidth={3} />
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 text-center">
            Application Submitted!
          </h1>
        </div>

        {/* White Bottom Section with Rounded Top Corners - Responsive */}
        <div className="bg-white rounded-t-3xl md:rounded-none -mt-8 md:mt-0 flex-1 px-6 pt-12 pb-8 md:py-12 md:flex md:items-center md:min-h-[500px] overflow-y-auto">
          <div className="max-w-md mx-auto w-full md:max-w-none space-y-6">
          {/* Card Container */}
          <div className="bg-[#FFF5E6] rounded-3xl p-6 space-y-6">
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
            <p className="text-sm text-gray-900">
              Welcome to WARMPAWZ Family 👋
            </p>
          </div>
          </div>

          {/* Contact Support Button */}
          <Button 
            variant="outline"
            onClick={() => window.location.href = 'mailto:support@warmpawz.com'}
            className="w-full bg-white border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50 h-12 rounded-xl"
          >
            Contact Support
          </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
