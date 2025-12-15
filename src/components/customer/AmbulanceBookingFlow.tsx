import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Ambulance, MapPin, Phone, AlertTriangle, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface AmbulanceBookingFlowProps {
  customerId: string;
  petId: string;
  petName: string;
}

export function AmbulanceBookingFlow({ customerId, petId, petName }: AmbulanceBookingFlowProps) {
  const [step, setStep] = useState<'details' | 'tracking'>('details');
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  
  const [emergencyType, setEmergencyType] = useState('');
  const [severity, setSeverity] = useState('urgent');
  const [description, setDescription] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropAddress, setDropAddress] = useState('');

  const handleEmergencyBooking = async () => {
    if (!emergencyType || !description || !pickupAddress || !dropAddress) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);

      // Get coordinates (in production, use Google Places API)
      const pickupLocation = {
        address: pickupAddress,
        lat: 28.6139,
        lng: 77.2090,
        contactName: 'Customer Name',
        contactPhone: '9876543210'
      };

      const dropLocation = {
        address: dropAddress,
        lat: 28.6200,
        lng: 77.2100,
        facilityName: 'Emergency Veterinary Hospital'
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ambulance/emergency-booking`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            customerId,
            petId,
            emergencyType,
            severity,
            description,
            pickupLocation,
            dropLocation
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBooking(data.booking);
        setStep('tracking');
        toast.success('Emergency ambulance requested successfully!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to request ambulance');
      }
    } catch (error) {
      console.error('Error requesting ambulance:', error);
      toast.error('Error requesting ambulance');
    } finally {
      setLoading(false);
    }
  };

  const renderEmergencyDetails = () => (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-red-900 mb-1">Emergency Ambulance</h3>
          <p className="text-sm text-red-700">Request immediate ambulance service for {petName}</p>
        </div>
      </div>

      {/* Emergency Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Emergency Type *
        </label>
        <div className="grid grid-cols-2 gap-3">
          {['accident', 'illness', 'injury', 'other'].map((type) => (
            <button
              key={type}
              onClick={() => setEmergencyType(type)}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${
                emergencyType === type
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="font-medium text-gray-900 capitalize">{type}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Severity */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Severity *
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'critical', label: 'Critical', color: 'red' },
            { id: 'urgent', label: 'Urgent', color: 'orange' },
            { id: 'normal', label: 'Normal', color: 'green' }
          ].map((sev) => (
            <button
              key={sev.id}
              onClick={() => setSeverity(sev.id)}
              className={`p-3 rounded-lg border-2 text-center transition-colors ${
                severity === sev.id
                  ? `border-${sev.color}-500 bg-${sev.color}-50`
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className={`font-medium text-${sev.color}-700`}>{sev.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Emergency Description *
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the emergency situation..."
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      {/* Pickup Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pickup Address *
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            placeholder="Enter pickup address"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Drop Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Drop Address (Veterinary Hospital) *
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={dropAddress}
            onChange={(e) => setDropAddress(e.target.value)}
            placeholder="Enter hospital address"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      <Button
        onClick={handleEmergencyBooking}
        disabled={loading}
        className="w-full bg-red-600 hover:bg-red-700 py-6 text-lg"
      >
        {loading ? 'Requesting...' : 'Request Emergency Ambulance'}
      </Button>
    </div>
  );

  const renderTracking = () => (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-white rounded-xl border-2 border-orange-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
            <Ambulance className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-lg capitalize">
              {booking?.status?.replace(/_/g, ' ')}
            </p>
            <p className="text-sm text-gray-600">Booking ID: {booking?.id}</p>
          </div>
        </div>

        {/* Estimated Fare */}
        <div className="bg-orange-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-700 mb-1">Estimated Fare</p>
          <p className="text-2xl font-bold text-orange-600">₹{booking?.estimatedFare}</p>
        </div>

        {/* Driver Info */}
        {booking?.driverName && (
          <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">{booking.driverName}</p>
              <p className="text-sm text-gray-600">{booking.vehicleNumber}</p>
            </div>
            {booking.driverPhone && (
              <a href={`tel:${booking.driverPhone}`}>
                <Button variant="outline" size="sm">
                  <Phone className="w-4 h-4 mr-2" />
                  Call
                </Button>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Journey Timeline</h3>
        
        <div className="space-y-4">
          {[
            { status: 'requested', label: 'Request Received', time: booking?.requestedAt },
            { status: 'assigned', label: 'Ambulance Assigned', time: booking?.assignedAt },
            { status: 'en_route_to_pickup', label: 'On the Way', time: null },
            { status: 'arrived', label: 'Arrived at Pickup', time: booking?.arrivedAt },
            { status: 'pet_loaded', label: 'Pet Loaded', time: booking?.loadedAt },
            { status: 'en_route_to_facility', label: 'Heading to Hospital', time: null },
            { status: 'delivered', label: 'Arrived at Hospital', time: booking?.deliveredAt }
          ].map((item, idx) => {
            const isCompleted = booking?.status === item.status || 
              (booking?.status && ['requested', 'assigned', 'en_route_to_pickup', 'arrived', 'pet_loaded', 'en_route_to_facility', 'delivered'].indexOf(booking.status) > idx);
            
            return (
              <div key={item.status} className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isCompleted ? 'bg-green-500' : 'bg-gray-200'
                }`}>
                  {isCompleted && (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${isCompleted ? 'text-gray-900' : 'text-gray-500'}`}>
                    {item.label}
                  </p>
                  {item.time && (
                    <p className="text-xs text-gray-500">
                      {new Date(item.time).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Tracking */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Navigation className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-blue-900">Live Tracking</p>
          <p className="text-sm text-blue-700">Track ambulance location in real-time on the map</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6">
          {step === 'details' && renderEmergencyDetails()}
          {step === 'tracking' && renderTracking()}
        </div>
      </div>
    </div>
  );
}
