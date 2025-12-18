import { Video, Search, Bell, Home } from 'lucide-react';
import { Button } from '../ui/button';

interface VendorTeleConsultationConnectingProps {
  vendorData: any;
  customerName: string;
  onCancel: () => void;
}

export function VendorTeleConsultationConnecting({ 
  vendorData, 
  customerName,
  onCancel 
}: VendorTeleConsultationConnectingProps) {
  return (
    <div className="min-h-screen bg-[#F5F5FF]">
      <div className="w-full max-w-[430px] mx-auto bg-[#F5F5FF] min-h-screen">
        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold">09:41</span>
          <div className="flex items-center gap-1">
            <div className="flex gap-0.5">
              <div className="w-1 h-3 bg-black"></div>
              <div className="w-1 h-3 bg-black"></div>
              <div className="w-1 h-3 bg-black"></div>
              <div className="w-1 h-3 bg-black opacity-30"></div>
            </div>
            <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
              <path d="M0 2C0 0.895 0.895 0 2 0H13C14.105 0 15 0.895 15 2V9C15 10.105 14.105 11 13 11H2C0.895 11 0 10.105 0 9V2Z" fill="black"/>
            </svg>
            <div className="w-6 h-3 bg-black rounded-sm"></div>
          </div>
        </div>

        {/* Vendor Header Card */}
        <div className="mx-4 mt-4 mb-6 bg-white rounded-2xl border-2 border-blue-500 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Home className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">
                  {vendorData?.fullName || 'Dr. Priya Sharma'}
                </h2>
                <p className="text-xs text-gray-500">
                  {vendorData?.businessName || 'Jeeva Pet Clinic'}
                </p>
                <p className="text-xs text-gray-400">
                  {vendorData?.address || 'Bangalore, India'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                <Search className="w-5 h-5 text-gray-600" />
              </Button>
              <Button className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-gray-600" />
              </Button>
            </div>
          </div>
        </div>

        {/* Connecting Content */}
        <div className="mx-4 mt-12 bg-white rounded-3xl p-8">
          <div className="flex flex-col items-center">
            {/* Video Icon */}
            <div className="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center mb-8">
              <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center">
                <Video className="w-8 h-8 text-white" fill="white" />
              </div>
            </div>

            {/* Connecting Text */}
            <h1 className="text-2xl font-serif text-gray-900 mb-3">Connecting...</h1>
            <p className="text-gray-500 mb-8">
              Setting up video call with {customerName}
            </p>

            {/* Animated Dots */}
            <div className="flex gap-2 mb-12">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>

            {/* Cancel Button */}
            <Button onClick={onCancel}
              className="px-12 py-3 border-2 border-gray-300 rounded-full text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Button>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
          <div className="max-w-[430px] mx-auto flex items-center justify-around py-4">
            <Button className="flex flex-col items-center gap-1">
              <Home className="w-6 h-6 text-gray-400" />
              <span className="text-xs text-gray-500">Home</span>
            </Button>
            <Button className="flex flex-col items-center gap-1">
              <div className="w-6 h-6 text-[#FF8C42]">📋</div>
              <span className="text-xs text-[#FF8C42] font-medium">Prescription</span>
            </Button>
            <Button className="flex flex-col items-center gap-1">
              <div className="w-6 h-6 text-gray-400">📅</div>
              <span className="text-xs text-gray-500">Schedule</span>
            </Button>
            <Button className="flex flex-col items-center gap-1">
              <div className="w-6 h-6 text-gray-400">💳</div>
              <span className="text-xs text-gray-500">Payouts</span>
            </Button>
          </div>
          <div className="h-1 w-32 bg-black rounded-full mx-auto mb-2"></div>
        </div>
      </div>
    </div>
  );
}
