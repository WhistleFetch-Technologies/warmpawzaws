import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  Flask,
  MapPin,
  Calendar,
  Clock,
  Home,
  Building,
  CheckCircle,
  FileText,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface DiagnosticsBookingProps {
  customerId: string;
  petId: string;
  petName: string;
  onBookingComplete?: (bookingId: string) => void;
}

interface DiagnosticTest {
  testId: string;
  testName: string;
  category: string;
  description: string;
  price: number;
  duration: number;
  reportDeliveryTime: number;
  homeCollectionAvailable: boolean;
  homeCollectionCharge?: number;
  preparationInstructions?: string;
}

interface DiagnosticCenter {
  centerId: string;
  vendorId: string;
  centerName: string;
  address: string;
  city: string;
  distance: number;
  rating: number;
  homeCollectionAvailable: boolean;
}

export function DiagnosticsBookingFlow({
  customerId,
  petId,
  petName,
  onBookingComplete
}: DiagnosticsBookingProps) {
  const [step, setStep] = useState<'location' | 'centers' | 'tests' | 'booking' | 'confirm'>('location');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [centers, setCenters] = useState<DiagnosticCenter[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<DiagnosticCenter | null>(null);
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [bookingType, setBookingType] = useState<'home_collection' | 'center_visit'>('home_collection');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Get current location
  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const { latitude, longitude } = position.coords;
      setLocation({ lat: latitude, lng: longitude });
      toast.success('Location detected');
      
      // Automatically fetch nearby centers
      await fetchNearbyCenters(latitude, longitude);
      setStep('centers');

    } catch (error) {
      console.error('Error getting location:', error);
      toast.error('Failed to get location');
    } finally {
      setGettingLocation(false);
    }
  };

  // Fetch nearby centers
  const fetchNearbyCenters = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${BASE_URL}/diagnostics/centers/nearby?lat=${lat}&lng=${lng}&radius=20`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCenters(data.centers || []);
        
        if (data.centers.length === 0) {
          toast.info('No diagnostic centers found nearby');
        }
      }
    } catch (error) {
      console.error('Error fetching centers:', error);
      toast.error('Failed to fetch diagnostic centers');
    } finally {
      setLoading(false);
    }
  };

  // Fetch tests for selected center
  const fetchTests = async (centerId: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${BASE_URL}/diagnostics/center/${centerId}/tests`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTests(data.tests || []);
        setStep('tests');
      }
    } catch (error) {
      console.error('Error fetching tests:', error);
      toast.error('Failed to fetch tests');
    } finally {
      setLoading(false);
    }
  };

  // Toggle test selection
  const toggleTest = (testId: string) => {
    const newSelection = new Set(selectedTests);
    if (newSelection.has(testId)) {
      newSelection.delete(testId);
    } else {
      newSelection.add(testId);
    }
    setSelectedTests(newSelection);
  };

  // Calculate total amount
  const calculateTotal = () => {
    const selectedTestsList = tests.filter(t => selectedTests.has(t.testId));
    let total = selectedTestsList.reduce((sum, test) => sum + test.price, 0);
    
    if (bookingType === 'home_collection') {
      const maxCharge = Math.max(...selectedTestsList.map(t => t.homeCollectionCharge || 0), 0);
      total += maxCharge;
    }
    
    return total;
  };

  // Create booking
  const createBooking = async () => {
    if (selectedTests.size === 0) {
      toast.error('Please select at least one test');
      return;
    }

    if (!scheduledDate || !scheduledTime) {
      toast.error('Please select date and time');
      return;
    }

    if (bookingType === 'home_collection' && !address) {
      toast.error('Please provide your address');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/diagnostics/booking/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId,
          petId,
          petName,
          vendorId: selectedCenter?.vendorId,
          centerId: selectedCenter?.centerId,
          testIds: Array.from(selectedTests),
          bookingType,
          scheduledDate,
          scheduledTime,
          address: bookingType === 'home_collection' ? {
            street: address,
            city: selectedCenter?.city || '',
            state: '',
            pincode: ''
          } : undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Booking created successfully!');
        setStep('confirm');
        onBookingComplete?.(data.booking.bookingId);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create booking');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Error creating booking');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Location
  if (step === 'location') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Flask className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Book Diagnostic Tests
            </h2>
            <p className="text-gray-600">
              Find diagnostic centers near you for {petName}
            </p>
          </div>

          <Button
            onClick={getCurrentLocation}
            disabled={gettingLocation}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            <MapPin className="w-5 h-5 mr-2" />
            {gettingLocation ? 'Getting Location...' : 'Find Nearby Centers'}
          </Button>
        </div>
      </div>
    );
  }

  // Step 2: Select Center
  if (step === 'centers') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Nearby Diagnostic Centers
          </h2>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-6 border border-gray-200 rounded-lg animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : centers.length > 0 ? (
            <div className="space-y-4">
              {centers.map((center) => (
                <div
                  key={center.centerId}
                  className={`p-6 border-2 rounded-xl cursor-pointer transition-all ${
                    selectedCenter?.centerId === center.centerId
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => setSelectedCenter(center)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {center.centerName}
                      </h3>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {center.address}, {center.city}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-yellow-500">★</span>
                        <span className="font-medium text-gray-900">
                          {center.rating.toFixed(1)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{center.distance.toFixed(1)} km</p>
                    </div>
                  </div>

                  {center.homeCollectionAvailable && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                      <Home className="w-4 h-4" />
                      Home Collection Available
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No diagnostic centers found nearby</p>
            </div>
          )}

          {selectedCenter && (
            <Button
              onClick={() => fetchTests(selectedCenter.centerId)}
              disabled={loading}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700"
            >
              View Available Tests
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Step 3: Select Tests
  if (step === 'tests') {
    const selectedTestsList = tests.filter(t => selectedTests.has(t.testId));
    const total = calculateTotal();

    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Available Tests
            </h2>
            <p className="text-gray-600">{selectedCenter?.centerName}</p>
          </div>

          {/* Test Categories */}
          <div className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {['blood', 'urine', 'imaging', 'specialized'].map(category => (
                <button
                  key={category}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm capitalize hover:bg-gray-50"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Tests List */}
          <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
            {tests.map((test) => (
              <div
                key={test.testId}
                onClick={() => toggleTest(test.testId)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedTests.has(test.testId)
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{test.testName}</h3>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full capitalize">
                        {test.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{test.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>⏱ Report in {test.reportDeliveryTime}h</span>
                      {test.homeCollectionAvailable && (
                        <span className="text-green-600">🏠 Home collection available</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-gray-900">₹{test.price}</p>
                    {test.homeCollectionCharge && (
                      <p className="text-xs text-gray-500">
                        +₹{test.homeCollectionCharge} home
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Selected Tests Summary */}
          {selectedTests.size > 0 && (
            <div className="border-t pt-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">{selectedTests.size} tests selected</span>
                <span className="text-2xl font-bold text-gray-900">₹{total}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={() => setStep('centers')}
              variant="outline"
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={() => setStep('booking')}
              disabled={selectedTests.size === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Booking Details
  if (step === 'booking') {
    const total = calculateTotal();

    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Booking Details
          </h2>

          {/* Booking Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Collection Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setBookingType('home_collection')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  bookingType === 'home_collection'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <Home className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <p className="font-medium text-gray-900">Home Collection</p>
                <p className="text-xs text-gray-600 mt-1">We'll come to you</p>
              </button>
              
              <button
                onClick={() => setBookingType('center_visit')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  bookingType === 'center_visit'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <Building className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <p className="font-medium text-gray-900">Center Visit</p>
                <p className="text-xs text-gray-600 mt-1">Visit the center</p>
              </button>
            </div>
          </div>

          {/* Address (for home collection) */}
          {bookingType === 'home_collection' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Home Address
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter your complete address..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Date */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Preferred Date
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Time */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-2" />
              Preferred Time
            </label>
            <select
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select time slot</option>
              <option value="08:00-10:00">8:00 AM - 10:00 AM</option>
              <option value="10:00-12:00">10:00 AM - 12:00 PM</option>
              <option value="14:00-16:00">2:00 PM - 4:00 PM</option>
              <option value="16:00-18:00">4:00 PM - 6:00 PM</option>
            </select>
          </div>

          {/* Total */}
          <div className="border-t pt-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Amount</span>
              <span className="text-2xl font-bold text-gray-900">₹{total}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => setStep('tests')}
              variant="outline"
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={createBooking}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Booking...' : 'Confirm Booking'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step 5: Confirmation
  if (step === 'confirm') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Booking Confirmed!
          </h2>
          
          <p className="text-gray-600 mb-6">
            Your diagnostic test has been scheduled successfully
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-left">
            <h3 className="font-medium text-gray-900 mb-4">Booking Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium text-gray-900 capitalize">
                  {bookingType.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium text-gray-900">{scheduledDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Time:</span>
                <span className="font-medium text-gray-900">{scheduledTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tests:</span>
                <span className="font-medium text-gray-900">{selectedTests.size}</span>
              </div>
            </div>
          </div>

          <Button
            onClick={() => window.location.href = '/customer/bookings'}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            View My Bookings
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
