import { Search, Bell, Home, FileText, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface VendorTeleConsultationEndedProps {
  vendorData: any;
  appointmentData: {
    customerName: string;
    customerImage?: string;
    petName: string;
    petType: string;
    appointmentId: string;
    reason: string;
    duration: string;
  };
  onAddNotes: () => void;
  onWritePrescription: () => void;
  onBackToDashboard: () => void;
}

export function VendorTeleConsultationEnded({ 
  vendorData, 
  appointmentData,
  onAddNotes,
  onWritePrescription,
  onBackToDashboard
}: VendorTeleConsultationEndedProps) {
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
              <button className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                <Search className="w-5 h-5 text-gray-600" />
              </button>
              <button className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Call Ended Content */}
        <div className="mx-4 bg-white rounded-3xl p-8">
          <div className="flex flex-col items-center">
            {/* Phone Icon with Green Background */}
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </div>
            </div>

            {/* Call Ended Text */}
            <h1 className="text-2xl font-serif text-gray-900 mb-2">Call Ended</h1>
            
            {/* Consultation with Customer Name */}
            <p className="text-gray-500 mb-8">
              Consultation with {appointmentData.customerName}
            </p>

            {/* Customer Details Card */}
            <div className="w-full bg-gray-50 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-blue-200 to-blue-100">
                  {appointmentData.customerImage ? (
                    <ImageWithFallback 
                      src={appointmentData.customerImage} 
                      alt={appointmentData.customerName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-semibold text-blue-700">
                      {appointmentData.customerName.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{appointmentData.customerName}</h3>
                  <p className="text-sm text-gray-600">
                    {appointmentData.petName} • {appointmentData.petType}
                  </p>
                </div>
              </div>

              {/* Consultation Details */}
              <div className="space-y-3">
                {/* Duration */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Duration</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{appointmentData.duration}</span>
                </div>

                {/* Appointment ID */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <CalendarIcon className="w-4 h-4" />
                    <span className="text-sm">Appointment ID</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{appointmentData.appointmentId}</span>
                </div>

                {/* Reason */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm">Reason</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{appointmentData.reason}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full space-y-3">
              <button
                onClick={onAddNotes}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#FF8C42] rounded-full text-white font-medium hover:bg-[#ff7a28] transition-colors"
              >
                <FileText className="w-5 h-5" />
                Add Consultation Notes
              </button>

              <button
                onClick={onWritePrescription}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 border-2 border-gray-300 rounded-full text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                <FileText className="w-5 h-5" />
                Write Prescription
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
          <div className="max-w-[430px] mx-auto flex items-center justify-around py-4">
            <button onClick={onBackToDashboard} className="flex flex-col items-center gap-1">
              <Home className="w-6 h-6 text-gray-400" />
              <span className="text-xs text-gray-500">Home</span>
            </button>
            <button className="flex flex-col items-center gap-1">
              <div className="w-6 h-6 text-[#FF8C42]">📋</div>
              <span className="text-xs text-[#FF8C42] font-medium">Prescription</span>
            </button>
            <button className="flex flex-col items-center gap-1">
              <div className="w-6 h-6 text-gray-400">📅</div>
              <span className="text-xs text-gray-500">Schedule</span>
            </button>
            <button className="flex flex-col items-center gap-1">
              <div className="w-6 h-6 text-gray-400">💳</div>
              <span className="text-xs text-gray-500">Payouts</span>
            </button>
          </div>
          <div className="h-1 w-32 bg-black rounded-full mx-auto mb-2"></div>
        </div>
      </div>
    </div>
  );
}
