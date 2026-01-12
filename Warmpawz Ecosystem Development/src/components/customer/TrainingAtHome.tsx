import { ArrowLeft, Home } from 'lucide-react';

interface TrainingAtHomeProps {
  onBack: () => void;
  customerId: string;
  customerData: any;
  phone: string;
  onNavigate: (screen: string, data?: any) => void;
}

export function TrainingAtHome({ onBack, customerId, customerData, phone, onNavigate }: TrainingAtHomeProps) {
  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold">At-Home Training</h1>
            <p className="text-sm text-gray-600">Personal trainers come to you</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="w-16 h-16 bg-[#FF8C42]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Home className="w-8 h-8 text-[#FF8C42]" />
          </div>
          <h3 className="font-semibold mb-2">At-Home Training</h3>
          <p className="text-sm text-gray-600">
            This feature is coming soon. Our trainers will come to your home for personalized training sessions.
          </p>
        </div>
      </div>
    </div>
  );
}
