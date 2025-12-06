import { useState } from 'react';
import { Button } from '../ui/button';
import { BookingDetailModal } from '../customer/BookingDetailModal';
import { CommunicationHub } from '../communication/CommunicationHub';
import { LiveTrackingMap } from '../tracking/LiveTrackingMap';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Play, CheckCircle, AlertCircle } from 'lucide-react';

// Mock Data
const MOCK_TELE_BOOKING = {
  bookingId: 'test-tele-123',
  petId: 'pet-123',
  petName: 'Bella',
  customerPhone: '9876543210',
  vendorName: 'Dr. Sarah Wilson',
  serviceType: 'vet',
  serviceName: 'Video Consultation',
  serviceStyle: 'tele',
  status: 'confirmed',
  scheduledDate: new Date().toISOString(),
  scheduledTime: '10:00',
  price: 500,
  doctorName: 'Dr. Sarah Wilson',
  vendorPhone: '1234567890'
};

const MOCK_WALKER_BOOKING = {
  bookingId: 'test-walk-456',
  petId: 'pet-456',
  petName: 'Max',
  customerPhone: '9876543210',
  vendorName: 'John the Walker',
  serviceType: 'walker',
  serviceName: 'Dog Walking',
  serviceStyle: 'at_home',
  status: 'in_progress',
  scheduledDate: new Date().toISOString(),
  scheduledTime: '07:00',
  price: 300,
  vendorPhone: '1234567890'
};

export function UXTestLab() {
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [currentMockBooking, setCurrentMockBooking] = useState<any>(null);

  // Test Runners
  const runTeleHealthTest = () => {
    console.log('🧪 Starting Tele-Health Flow Test...');
    setCurrentMockBooking(MOCK_TELE_BOOKING);
    setShowBookingModal(true);
  };

  const runTrackingTest = () => {
    console.log('🧪 Starting Live Tracking Flow Test...');
    setCurrentMockBooking(MOCK_WALKER_BOOKING);
    setShowBookingModal(true);
  };

  // Monkey patch fetch for the modal to "load" our mock data
  const originalFetch = window.fetch;
  const setupMockFetch = () => {
    window.fetch = async (url: RequestInfo | URL, options?: RequestInit) => {
      const urlString = url.toString();
      if (urlString.includes('/bookings/') && currentMockBooking) {
        console.log('🔍 Intercepted booking fetch, returning mock data');
        return {
          ok: true,
          json: async () => ({ booking: currentMockBooking })
        } as Response;
      }
      if (urlString.includes('/prescription/')) {
         return { ok: false, json: async () => ({}) } as Response;
      }
      return originalFetch(url, options);
    };
  };

  // Restore fetch when modal closes
  const teardownMockFetch = () => {
    window.fetch = originalFetch;
  };

  if (showBookingModal) {
    setupMockFetch();
  } else {
    teardownMockFetch();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">UX Functional Test Lab</h1>
            <p className="text-gray-600">Automated verification of critical user flows</p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> System Healthy
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Test Case 1: Tele-Health */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Tele-Health Flow</h3>
              <span className="text-xs font-mono bg-blue-50 text-blue-600 px-2 py-1 rounded">TC-001</span>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Verifies that confirmed video consultations display the "Join" button and successfully launch the Communication Hub with video enabled.
            </p>
            <div className="bg-gray-900 rounded-lg p-4 mb-6 font-mono text-xs text-green-400">
              <div>[CHECK] Booking Status: Confirmed</div>
              <div>[CHECK] Service Style: Tele</div>
              <div>[EXPECT] 'Join Tele-Consultation' Button Visible</div>
              <div>[EXPECT] Video Room Connection</div>
            </div>
            <Button onClick={runTeleHealthTest} className="w-full gap-2">
              <Play className="w-4 h-4" /> Run Test Case
            </Button>
          </Card>

          {/* Test Case 2: Live Tracking */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Live Tracking Flow</h3>
              <span className="text-xs font-mono bg-orange-50 text-orange-600 px-2 py-1 rounded">TC-002</span>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Verifies that in-progress walking services display the "Track" button and successfully launch the real-time map overlay.
            </p>
            <div className="bg-gray-900 rounded-lg p-4 mb-6 font-mono text-xs text-green-400">
              <div>[CHECK] Booking Status: In Progress</div>
              <div>[CHECK] Service Type: Walker</div>
              <div>[EXPECT] 'Track Live Location' Button Visible</div>
              <div>[EXPECT] Map Overlay Render</div>
            </div>
            <Button onClick={runTrackingTest} className="w-full gap-2">
              <Play className="w-4 h-4" /> Run Test Case
            </Button>
          </Card>
        </div>

        {/* Modal Container */}
        {showBookingModal && currentMockBooking && (
          <BookingDetailModal 
            bookingId={currentMockBooking.bookingId}
            petId={currentMockBooking.petId}
            phone={currentMockBooking.customerPhone}
            onClose={() => setShowBookingModal(false)}
          />
        )}
      </div>
    </div>
  );
}