'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { MapPin, Phone, AlertCircle, Clock, User } from 'lucide-react';

interface AmbulanceBookingFlowProps {
  vendorId: string;
  customerPhone: string;
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
}

interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: 'basic' | 'advanced' | 'critical_care';
  capacity: number;
  equipment: string[];
  current_location: any;
  is_available: boolean;
  rating: number;
  estimated_arrival?: number; // minutes
}

export function AmbulanceBookingFlow({ vendorId, customerPhone, onSuccess, onCancel }: AmbulanceBookingFlowProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Booking details
  const [emergencyType, setEmergencyType] = useState<'emergency' | 'transfer' | 'other'>('emergency');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [condition, setCondition] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropAddress, setDropAddress] = useState('');
  const [urgency, setUrgency] = useState<'critical' | 'urgent' | 'normal'>('urgent');
  const [contactPhone, setContactPhone] = useState(customerPhone);

  useEffect(() => {
    loadAvailableVehicles();
  }, [vendorId]);

  const loadAvailableVehicles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/ambulance/vehicles`);
      
      if (response.success && response.vehicles) {
        const available = response.vehicles.filter((v: Vehicle) => v.is_available);
        setVehicles(available);
        
        // Auto-select first available vehicle
        if (available.length > 0 && !selectedVehicle) {
          setSelectedVehicle(available[0].id);
        }
      }
    } catch (err: any) {
      console.error('Error loading vehicles:', err);
      setError('Failed to load available ambulances');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedVehicle) {
      setError('Please select an ambulance');
      return;
    }

    if (!pickupAddress.trim()) {
      setError('Pickup address is required');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Get customer ID
      const customerResponse = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
      const customerId = customerResponse.customer?.id;

      if (!customerId) {
        throw new Error('Customer not found');
      }

      // Create emergency booking
      const bookingData = {
        serviceId: 'ambulance', // Special service type
        vendorId,
        customerId,
        serviceType: 'at_home',
        bookingType: 'emergency',
        bookingDate: new Date().toISOString().split('T')[0],
        bookingTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
        address: pickupAddress,
        dropAddress: dropAddress || pickupAddress,
        notes: JSON.stringify({
          emergencyType,
          patientName,
          patientAge,
          condition,
          urgency,
          vehicleId: selectedVehicle,
          contactPhone,
        }),
        totalAmount: calculatePrice(),
      };

      const bookingResponse = await apiClient.post<any>('/bookings/create', bookingData);

      if (bookingResponse.success && bookingResponse.booking) {
        if (onSuccess) {
          onSuccess(bookingResponse.booking.id);
        }
      } else {
        throw new Error(bookingResponse.error || 'Failed to create booking');
      }
    } catch (err: any) {
      console.error('Error creating booking:', err);
      setError(err.message || 'Failed to book ambulance. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const calculatePrice = (): number => {
    const vehicle = vehicles.find(v => v.id === selectedVehicle);
    if (!vehicle) return 0;

    const basePrice: Record<string, number> = {
      basic: 500,
      advanced: 1000,
      critical_care: 2000,
    };

    let price = basePrice[vehicle.vehicle_type] || 500;
    
    // Add urgency multiplier
    if (urgency === 'critical') price *= 1.5;
    if (urgency === 'urgent') price *= 1.2;

    // Add distance-based pricing (simplified)
    if (dropAddress && dropAddress !== pickupAddress) {
      price += 200; // Additional charge for drop-off
    }

    return Math.round(price);
  };

  const getVehicleTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      basic: 'Basic Ambulance',
      advanced: 'Advanced Life Support',
      critical_care: 'Critical Care',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-02">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-0">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-0 flex items-start gap-3">
        <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <h3 className="font-semibold text-red-900">Emergency Ambulance Booking</h3>
          <p className="text-sm text-red-700 mt-0">
            For life-threatening emergencies, please call emergency services directly.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Emergency Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Service Type
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['emergency', 'transfer', 'other'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setEmergencyType(type)}
                className={`px-4 py-0 rounded-lg border-2 transition ${
                  emergencyType === type
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Patient Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Patient Name *
            </label>
            <input
              type="text"
              value={patientName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPatientName(e.target.value)}
              required
              className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Age
            </label>
            <input
              type="number"
              value={patientAge}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPatientAge(e.target.value)}
              className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Medical Condition
          </label>
          <textarea
            value={condition}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCondition(e.target.value)}
            rows={3}
            placeholder="Describe the patient's condition..."
            className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        {/* Urgency Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Urgency Level
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['critical', 'urgent', 'normal'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setUrgency(level)}
                className={`px-4 py-0 rounded-lg border-2 transition ${
                  urgency === level
                    ? level === 'critical'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : level === 'urgent'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-yellow-500 bg-yellow-50 text-yellow-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Addresses */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Pickup Address *
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-0 text-gray-400" size={20} />
            <input
              type="text"
              value={pickupAddress}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPickupAddress(e.target.value)}
              required
              placeholder="Enter pickup location"
              className="w-full pl-0 pr-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Drop-off Address (if different)
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-0 text-gray-400" size={20} />
            <input
              type="text"
              value={dropAddress}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDropAddress(e.target.value)}
              placeholder="Enter drop-off location (optional)"
              className="w-full pl-0 pr-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {/* Contact */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Contact Phone *
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1 text-gray-400" size={20} />
            <input
              type="tel"
              value={contactPhone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactPhone(e.target.value)}
              required
              className="w-full pl-0 pr-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {/* Vehicle Selection */}
        {vehicles.length > 0 ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Select Ambulance *
            </label>
            <div className="space-y-3">
              {vehicles.map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => setSelectedVehicle(vehicle.id)}
                  className={`w-full p-4 rounded-lg border-2 text-left transition ${
                    selectedVehicle === vehicle.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">
                          {vehicle.vehicle_number}
                        </span>
                        <span className="px-0 py-0 bg-blue-100 text-blue-700 rounded text-xs">
                          {getVehicleTypeLabel(vehicle.vehicle_type)}
                        </span>
                      </div>
                      <div className="mt-0 flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-3">
                          <User size={14} />
                          Capacity: {vehicle.capacity}
                        </span>
                        <span className="flex items-center gap-3">
                          ⭐ {Number(vehicle.rating || 0).toFixed(1)}
                        </span>
                        {vehicle.estimated_arrival && (
                          <span className="flex items-center gap-3">
                            <Clock size={14} />
                            ETA: {vehicle.estimated_arrival} min
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-orange-600">
                        ₹{calculatePrice()}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
            No ambulances available at the moment. Please try again later or contact directly.
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-0 py-0 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={processing || !selectedVehicle || !pickupAddress}
            className="flex-1 px-0 py-0 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {processing ? 'Booking...' : 'Book Ambulance'}
          </button>
        </div>
      </form>
    </div>
  );
}

