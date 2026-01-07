'use client';

import { useState, useEffect } from 'react';
import { MapPin, Star, Clock, Phone, Calendar, Image as ImageIcon, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface Facility {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  rating?: number;
  reviewCount?: number;
  photos?: string[];
  amenities?: string[];
  hours?: {
    [key: string]: string;
  };
  phone?: string;
  distance?: number;
}

interface FacilityViewProps {
  facilityId: string;
  onBack?: () => void;
  onBook?: (facilityId: string) => void;
}

export function FacilityView({ facilityId, onBack, onBook }: FacilityViewProps) {
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  useEffect(() => {
    loadFacility();
  }, [facilityId]);

  const loadFacility = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ facility: Facility }>(`/facility/${facilityId}`);
      if (response.facility) {
        setFacility(response.facility);
      }
    } catch (error) {
      console.error('Error loading facility:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading facility...</p>
        </div>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center p-0">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Facility not found</p>
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
      <div className="bg-white border-b sticky top-0 z-10 px-0 py-4">
        {onBack && (
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors mb-4"
          >
            ←
          </button>
        )}
        <h1 className="text-2xl font-bold text-gray-900">{facility.name}</h1>
      </div>

      {/* Photos */}
      {facility.photos && facility.photos.length > 0 && (
        <div className="relative h-64 bg-gray-200">
          <img
            src={facility.photos[selectedPhotoIndex]}
            alt={facility.name}
            className="w-full h-full object-cover"
          />
          {facility.photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-0">
              {facility.photos.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedPhotoIndex(idx)}
                  className={`w-2 h-2 rounded-full ${
                    idx === selectedPhotoIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="px-0 py-0 space-y-6">
        {/* Rating & Reviews */}
        {facility.rating && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-0">
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              <span className="text-2xl font-bold">{facility.rating.toFixed(1)}</span>
            </div>
            {facility.reviewCount && (
              <span className="text-gray-600">({facility.reviewCount} reviews)</span>
            )}
          </div>
        )}

        {/* Location */}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-start gap-0">
            <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-0">Location</h3>
              <p className="text-gray-600">{facility.address}</p>
              <p className="text-gray-600">{facility.city}</p>
              {facility.distance && (
                <p className="text-sm text-primary mt-0">{facility.distance.toFixed(1)} km away</p>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {facility.description && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-0">About</h3>
            <p className="text-gray-600">{facility.description}</p>
          </div>
        )}

        {/* Amenities */}
        {facility.amenities && facility.amenities.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-0">Amenities</h3>
            <div className="flex flex-wrap gap-0">
              {facility.amenities.map((amenity, idx) => (
                <span
                  key={idx}
                  className="px-0 py-0.5 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  {amenity}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Hours */}
        {facility.hours && (
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-0">Operating Hours</h3>
            <div className="space-y-2">
              {Object.entries(facility.hours).map(([day, hours]) => (
                <div key={day} className="flex justify-between">
                  <span className="text-gray-600">{day}</span>
                  <span className="font-medium text-gray-900">{hours}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        {facility.phone && (
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-0">
              <Phone className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold text-gray-900">Contact</h3>
                <a href={`tel:${facility.phone}`} className="text-primary hover:underline">
                  {facility.phone}
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Book Button */}
        {onBook && (
          <button
            onClick={() => onBook(facility.id)}
            className="w-full py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors flex items-center justify-center gap-0"
          >
            Book Service
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

