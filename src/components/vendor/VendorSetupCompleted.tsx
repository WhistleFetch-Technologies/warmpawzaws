import { CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';

interface VendorSetupCompletedProps {
  onContinue: () => void;
}

export function VendorSetupCompleted({ onContinue }: VendorSetupCompletedProps) {
  return (
    <div className="min-h-screen bg-[#E8F5E3] flex items-center justify-center p-4">
      <div className="w-full max-w-[430px] bg-white rounded-3xl shadow-lg p-8 text-center space-y-6">
        {/* Green Success Badge */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" strokeWidth={3} />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl text-gray-900">
            🎉 Setup Completed !
          </h1>
          <p className="text-gray-600">
            Your Warmpawz profile is now live<br />
            and ready to receive bookings!
          </p>
        </div>

        {/* Success Message */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-700 font-medium">
            ✨ Pet Parents can now discover and book<br />
            your services
          </p>
        </div>

        {/* Continue Button */}
        <Button
          onClick={onContinue}
          className="w-full h-12 bg-green-500 hover:bg-green-600 text-white rounded-xl mt-8"
        >
          Go to Dashboard
        </Button>

        <p className="text-xs text-gray-500">
          You can manage your profile, services, and bookings from the dashboard
        </p>
      </div>
    </div>
  );
}
