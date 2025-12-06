import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Play, CheckCircle, XCircle, AlertCircle, RefreshCw, 
  User, Calendar, Video, FileText, MessageSquare, Package 
} from 'lucide-react';

// Components to Test
import { VendorOnboarding } from '../vendor/VendorOnboarding';
import { BookingDetailModal } from '../customer/BookingDetailModal';
import { VendorDashboard } from '../vendor/VendorDashboard';
import { AppointmentDetailModal } from '../vendor/AppointmentDetailModal';
import { VendorPrescriptionModal } from '../vendor/VendorPrescriptionModal';

// Mock Data Generators
const generateMockVendor = (id: string, role: string) => ({
  id,
  fullName: 'Dr. Test Vendor',
  businessName: 'Test Vet Clinic',
  roleId: role,
  status: 'approved',
  isActive: true,
  setupCompleted: true
});

const generateMockBooking = (id: string, type: 'tele' | 'clinic' | 'home', status: string) => ({
  id,
  status,
  serviceType: 'vet',
  serviceName: 'General Consultation',
  serviceStyle: type,
  scheduledDate: new Date().toISOString(),
  scheduledTime: '10:00 AM',
  duration: 30,
  price: 500,
  customerName: 'Test Customer',
  customerPhone: '9876543210',
  petName: 'Buddy',
  petType: 'Dog',
  petBreed: 'Golden Retriever',
  petAge: '2 years',
  vendorName: 'Dr. Test Vendor',
  vendorId: 'test-vendor-1',
  doctorName: 'Dr. Test Vendor',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  // Tele specific
  meetingLink: type === 'tele' ? 'https://meet.google.com/abc' : null,
  // Follow up specific
  otpVerifiedAt: status === 'completed' ? new Date().toISOString() : null,
});

const generateMockPrescription = (bookingId: string) => ({
  id: `rx-${bookingId}`,
  bookingId,
  medications: 'Amoxicillin 250mg',
  dosage: '1 tablet',
  frequency: 'Twice Daily',
  duration: '5 days',
  notes: 'Take with food',
  uploadedAt: new Date().toISOString(),
  uploadedBy: 'Dr. Test Vendor'
});

export function SystemTestLab() {
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [testState, setTestState] = useState<any>({});
  const [currentStep, setCurrentStep] = useState(0);
  
  // Mock Fetch Interceptor
  const originalFetch = window.fetch;
  
  const log = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] [${type.toUpperCase()}] ${message}`, ...prev]);
  };

  const setupMockFetch = (scenario: string) => {
    window.fetch = async (url: RequestInfo | URL, options?: RequestInit) => {
      const urlString = url.toString();
      log(`Intercepted API Call: ${urlString}`, 'info');

      // 1. Vendor Profile Mock
      if (urlString.includes('/vendor/profile/')) {
        return {
          ok: true,
          json: async () => ({ vendor: generateMockVendor('test-vendor-1', 'veterinarian') })
        } as Response;
      }

      // 2. Booking Details Mock
      if (urlString.includes('/bookings/') || urlString.includes('/vendor/bookings/')) {
        const bookingId = urlString.split('/').pop()?.replace('/details', '');
        const booking = generateMockBooking(bookingId || 'test-booking', 'tele', testState.bookingStatus || 'confirmed');
        
        return {
          ok: true,
          json: async () => ({ 
            booking,
            activities: [], 
            prescriptions: testState.hasPrescription ? [generateMockPrescription(bookingId || 'test-booking')] : []
          })
        } as Response;
      }

      // 3. Dashboard Stats
      if (urlString.includes('/vendor/dashboard/')) {
        return {
          ok: true,
          json: async () => ({ success: true, stats: { appointments: 5, earnings: 2500, rating: 4.8 } })
        } as Response;
      }

      // 4. Schedule
      if (urlString.includes('/vendor/schedule/')) {
        return {
          ok: true,
          json: async () => ({ 
            success: true, 
            schedule: [generateMockBooking('test-booking-1', 'tele', 'confirmed')]
          })
        } as Response;
      }

      // 5. Prescription Upload
      if (urlString.includes('/vendor/prescription/upload')) {
        log('Prescription Upload API called', 'success');
        setTestState(prev => ({ ...prev, hasPrescription: true }));
        return { ok: true, json: async () => ({ success: true }) } as Response;
      }
      
      // 6. Prescription Fetch
      if (urlString.includes('/prescription/booking/')) {
        if (testState.hasPrescription) {
           return {
            ok: true,
            json: async () => ({ prescription: generateMockPrescription('test-booking-1') })
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      }

      return originalFetch(url, options);
    };
  };

  const teardownMockFetch = () => {
    window.fetch = originalFetch;
  };

  // Test Runners
  const runFullRegression = async () => {
    setActiveTest('full-regression');
    setLogs([]);
    setTestState({ bookingStatus: 'confirmed', hasPrescription: false });
    setCurrentStep(1);
    setupMockFetch('full-regression');
    log('Starting Full Regression Test Suite...', 'info');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-mono">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#FF8C42]">System Test Lab</h1>
            <p className="text-gray-400">Automated End-to-End Functional Regression</p>
          </div>
          <div className="flex gap-4">
            <Button onClick={teardownMockFetch} variant="outline" className="text-white border-white/20">
              Reset Mock Network
            </Button>
            <Button onClick={runFullRegression} className="bg-green-600 hover:bg-green-700 text-white gap-2">
              <Play className="w-4 h-4" /> Run Full Regression
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Logs Panel */}
          <div className="lg:col-span-1 bg-gray-800 rounded-xl p-4 h-[80vh] overflow-y-auto border border-gray-700">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Execution Logs
            </h3>
            <div className="space-y-2 text-xs">
              {logs.length === 0 && <span className="text-gray-500">Ready to execute...</span>}
              {logs.map((log, i) => (
                <div key={i} className={`
                  ${log.includes('[SUCCESS]') ? 'text-green-400' : 
                    log.includes('[ERROR]') ? 'text-red-400' : 'text-gray-300'}
                `}>
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Visual Verification Stage */}
          <div className="lg:col-span-2 space-y-6">
            {activeTest === 'full-regression' && (
              <div className="bg-white rounded-xl p-4 h-[80vh] overflow-y-auto relative text-gray-900">
                {/* Step 1: Vendor Dashboard */}
                {currentStep === 1 && (
                  <div>
                    <div className="bg-blue-50 p-3 mb-4 rounded-lg border border-blue-200">
                      <h4 className="font-bold text-blue-800">Step 1: Verify Vendor Dashboard & Schedule</h4>
                      <p className="text-sm text-blue-600">Check if the 'Tele' booking appears in the schedule.</p>
                    </div>
                    <VendorDashboard 
                      vendorId="test-vendor-1" 
                      vendorData={generateMockVendor('test-vendor-1', 'veterinarian')} 
                    />
                    <div className="fixed bottom-8 right-8 flex gap-2">
                      <Button onClick={() => {
                        log('Vendor Dashboard Verified', 'success');
                        setCurrentStep(2);
                      }} className="bg-green-600 text-white shadow-lg">
                        Confirm & Next <CheckCircle className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 2: Vendor Appointment Detail */}
                {currentStep === 2 && (
                  <div>
                    <div className="bg-blue-50 p-3 mb-4 rounded-lg border border-blue-200">
                      <h4 className="font-bold text-blue-800">Step 2: Verify Appointment Details & Prescription</h4>
                      <p className="text-sm text-blue-600">Open the booking. Try adding a prescription.</p>
                    </div>
                    <AppointmentDetailModal 
                      bookingId="test-booking-1"
                      vendorData={generateMockVendor('test-vendor-1', 'veterinarian')}
                      onClose={() => {}}
                    />
                    <div className="fixed bottom-8 right-8 flex gap-2">
                      <Button onClick={() => {
                        log('Appointment Details Verified', 'success');
                        setCurrentStep(3);
                      }} className="bg-green-600 text-white shadow-lg">
                        Confirm & Next <CheckCircle className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: Customer Booking View (Prescription) */}
                {currentStep === 3 && (
                  <div>
                     <div className="bg-blue-50 p-3 mb-4 rounded-lg border border-blue-200">
                      <h4 className="font-bold text-blue-800">Step 3: Verify Customer View (Prescription)</h4>
                      <p className="text-sm text-blue-600">
                        Checking if customer can see the prescription added in Step 2.
                        (Mock state updated: hasPrescription = true)
                      </p>
                    </div>
                    <BookingDetailModal 
                      bookingId="test-booking-1"
                      petId="pet-1"
                      phone="9876543210"
                      onClose={() => {}}
                    />
                     <div className="fixed bottom-8 right-8 flex gap-2">
                      <Button onClick={() => {
                        log('Customer View Verified', 'success');
                        setCurrentStep(4);
                      }} className="bg-green-600 text-white shadow-lg">
                        Confirm & Next <CheckCircle className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 4: Follow-up & Chat */}
                {currentStep === 4 && (
                   <div>
                     <div className="bg-blue-50 p-3 mb-4 rounded-lg border border-blue-200">
                      <h4 className="font-bold text-blue-800">Step 4: Verify Follow-up & Chat</h4>
                      <p className="text-sm text-blue-600">
                        Simulating a completed booking. 'Chat' and 'Follow-up' buttons should be active.
                      </p>
                    </div>
                    {/* Temporarily update mock state to 'completed' for this render */}
                    {(() => {
                      // We need to force the mock fetch to return 'completed' for this step
                       window.fetch = async (url: RequestInfo | URL, options?: RequestInit) => {
                        if (url.toString().includes('/bookings/')) {
                           return {
                            ok: true,
                            json: async () => ({ 
                              booking: { 
                                ...generateMockBooking('test-booking-1', 'tele', 'completed'),
                                otpVerifiedAt: new Date().toISOString() // Enable chat/followup
                              }
                            })
                          } as Response;
                        }
                        return originalFetch(url, options);
                      };
                      return null;
                    })()}
                    <BookingDetailModal 
                      bookingId="test-booking-1"
                      petId="pet-1"
                      phone="9876543210"
                      onClose={() => {}}
                    />
                     <div className="fixed bottom-8 right-8 flex gap-2">
                      <Button onClick={() => {
                        log('All Regression Tests Passed!', 'success');
                        setActiveTest(null);
                        teardownMockFetch();
                      }} className="bg-green-600 text-white shadow-lg">
                        Finish Test <CheckCircle className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {!activeTest && (
              <div className="h-[80vh] flex items-center justify-center text-gray-500 border border-gray-700 rounded-xl border-dashed">
                Select a test suite to begin visual verification.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}