'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, X, Clock, MapPin, Phone, Navigation } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface IntegratedService {
  id: string;
  type: 'ambulance' | 'diagnostic' | 'pharmacy';
  providerName: string;
  providerId: string;
  status: 'requested' | 'confirmed' | 'in_transit' | 'arrived' | 'completed' | 'cancelled';
  estimatedArrival?: string;
  location?: { lat: number; lng: number; address: string };
  phone?: string;
  vehicleNumber?: string;
  driverName?: string;
}

interface IntegratedServicesCompleteProps {
  serviceId: string;
  onBack?: () => void;
  onCancel?: (serviceId: string) => void;
}

export function IntegratedServicesComplete({
  serviceId,
  onBack,
  onCancel
}: IntegratedServicesCompleteProps) {
  const [service, setService] = useState<IntegratedService | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadService();
    const interval = setInterval(loadService, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [serviceId]);

  const loadService = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ service: IntegratedService }>(
        `/integrated-services/${serviceId}`
      );
      if (response.service) {
        setService(response.service);
      }
    } catch (error) {
      console.error('Error loading service:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!service) return;
    try {
      await apiClient.post(`/integrated-services/${serviceId}/cancel`);
      onCancel?.(serviceId);
    } catch (error) {
      console.error('Error cancelling service:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested': return 'bg-blue-100 text-blue-700';
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'in_transit': return 'bg-yellow-100 text-yellow-700';
      case 'arrived': return 'bg-purple-100 text-purple-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'requested': return 'Requested';
      case 'confirmed': return 'Confirmed';
      case 'in_transit': return 'In Transit';
      case 'arrived': return 'Arrived';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading service status...</p>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center p-0">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Service not found</p>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-0 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-dark px-0 pt-12 pb-0 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold">
              {service.type === 'ambulance' ? 'Ambulance' : 
               service.type === 'diagnostic' ? 'Diagnostic' : 'Pharmacy'} Service
            </h1>
            <p className="text-white/90 text-sm">{service.providerName}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-0 py-0 space-y-6">
        {/* Status Card */}
        <div className="bg-white rounded-2xl p-0 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Service Status</h2>
            <span className={`px-0 py-0 rounded-full text-sm font-semibold ${getStatusColor(service.status)}`}>
              {getStatusLabel(service.status)}
            </span>
          </div>
          {service.estimatedArrival && (
            <div className="flex items-center gap-0 text-gray-600">
              <Clock className="w-5 h-5" />
              <span>Estimated arrival: {service.estimatedArrival}</span>
            </div>
          )}
        </div>

        {/* Provider Info */}
        <div className="bg-white rounded-2xl p-0 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-0">Provider Details</h3>
          <p className="text-gray-900 font-medium mb-0">{service.providerName}</p>
          {service.driverName && (
            <p className="text-sm text-gray-600">Driver: {service.driverName}</p>
          )}
          {service.vehicleNumber && (
            <p className="text-sm text-gray-600">Vehicle: {service.vehicleNumber}</p>
          )}
          {service.phone && (
            <a
              href={`tel:${service.phone}`}
              className="flex items-center gap-0 text-primary mt-0 hover:underline"
            >
              <Phone className="w-5 h-5" />
              <span>{service.phone}</span>
            </a>
          )}
        </div>

        {/* Location */}
        {service.location && (
          <div className="bg-white rounded-2xl p-0 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-0">Location</h3>
            <div className="flex items-start gap-0">
              <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0" />
              <div>
                <p className="text-gray-900">{service.location.address}</p>
                <button className="flex items-center gap-0 text-primary mt-0 hover:underline">
                  <Navigation className="w-4 h-4" />
                  <span>Get Directions</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {service.status !== 'completed' && service.status !== 'cancelled' && (
          <div className="space-y-3">
            {service.status === 'in_transit' || service.status === 'arrived' ? (
              <button
                onClick={() => window.location.href = `tel:${service.phone}`}
                className="w-full py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors flex items-center justify-center gap-0"
              >
                <Phone className="w-5 h-5" />
                Call Provider
              </button>
            ) : null}
            <button
              onClick={handleCancel}
              className="w-full py-4 border-2 border-red-500 text-red-500 rounded-xl font-semibold hover:bg-red-50 transition-colors"
            >
              Cancel Service
            </button>
          </div>
        )}

        {service.status === 'completed' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-0 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="font-bold text-green-900 mb-0">Service Completed</h3>
            <p className="text-green-700">Thank you for using our service!</p>
          </div>
        )}
      </div>
    </div>
  );
}

