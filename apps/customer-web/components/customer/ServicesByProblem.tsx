'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Star, MapPin, Clock, ChevronRight, ArrowLeft, Filter, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { ServiceDescriptionInline } from './shared/ServiceDescriptionInline';
import {
  groupByProblemRowsByVendor,
  type ByProblemServiceRow,
  type VendorGroupFromProblem,
} from '@/lib/group-by-problem-vendors';
import { pickVendorPhotoFromRow } from '@/lib/resolve-display-image-url';
import { StarRating } from './shared/StarRating';

interface Service {
  serviceId: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  vendorId: string;
  vendorName: string;
  vendorRating: number;
  vendorReviews: number;
  distance?: number;
  availability?: string;
  imageUrl?: string;
  relevanceScore?: number;
}

interface ServicesByProblemProps {
  problemId: string;
  problemTitle: string;
  onBack: () => void;
  onServiceSelect: (service: Service) => void;
  className?: string;
}

function rowToService(row: ByProblemServiceRow): Service {
  const price = typeof row.price === 'number' ? row.price : parseFloat(String(row.price || 0)) || 0;
  const dist = row.distance != null && row.distance !== '' ? Number(row.distance) : undefined;
  return {
    serviceId: String(row.serviceId || row.service_id || ''),
    name: String(row.serviceName || row.name || 'Service'),
    description: String(row.description || ''),
    price,
    duration: Number(row.duration) || 0,
    vendorId: String(row.vendorId || row.vendor_id || ''),
    vendorName: String(row.vendorName || row.vendor_name || ''),
    vendorRating: Number(row.vendorRating ?? row.rating ?? 0),
    vendorReviews: Number(row.vendorReviews ?? row.reviewCount ?? 0),
    distance: dist !== undefined && Number.isFinite(dist) ? dist : undefined,
    imageUrl: pickVendorPhotoFromRow(row as Record<string, unknown>),
    relevanceScore: (row as { relevanceScore?: number }).relevanceScore,
  };
}

export function ServicesByProblem({
  problemId,
  problemTitle,
  onBack,
  onServiceSelect,
  className = '',
}: ServicesByProblemProps) {
  const [flatRows, setFlatRows] = useState<ByProblemServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'relevance' | 'price' | 'rating' | 'distance'>('relevance');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [view, setView] = useState<'vendors' | 'services'>('vendors');
  const [selectedVendor, setSelectedVendor] = useState<VendorGroupFromProblem | null>(null);

  useEffect(() => {
    const { getCurrentPositionSafe } = require('@/lib/geolocation-utils');
    getCurrentPositionSafe((coords: { lat: number; lng: number }) => setUserLocation(coords));
  }, []);

  useEffect(() => {
    fetchServices();
  }, [problemId, userLocation]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ problemId });
      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lng', userLocation.lng.toString());
      }

      const data = await apiClient.get<{ services?: ByProblemServiceRow[]; data?: { services?: ByProblemServiceRow[] } }>(
        `/customer/services/by-problem?${params.toString()}`
      );
      const rows = data.data?.services || data.services || [];
      setFlatRows(Array.isArray(rows) ? rows : []);
      setView('vendors');
      setSelectedVendor(null);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const vendorsGrouped = useMemo(() => groupByProblemRowsByVendor(flatRows), [flatRows]);

  const sortedVendors = useMemo(() => {
    const list = [...vendorsGrouped];
    switch (sortBy) {
      case 'price':
        return list.sort((a, b) => a.minPrice - b.minPrice);
      case 'rating':
        return list.sort((a, b) => b.rating - a.rating);
      case 'distance':
        return list.sort((a, b) => {
          const da = a.distance ?? 999;
          const db = b.distance ?? 999;
          return da - db;
        });
      case 'relevance':
      default:
        return list;
    }
  }, [vendorsGrouped, sortBy]);

  const sortedServiceRows = useMemo(() => {
    if (!selectedVendor) return [];
    const list = [...selectedVendor.rows];
    switch (sortBy) {
      case 'price':
        return list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
      case 'rating':
        return list.sort(
          (a, b) => (Number(b.vendorRating ?? b.rating) || 0) - (Number(a.vendorRating ?? a.rating) || 0)
        );
      case 'distance':
        return list.sort((a, b) => (Number(a.distance) || 999) - (Number(b.distance) || 999));
      case 'relevance':
      default:
        return list;
    }
  }, [selectedVendor, sortBy]);

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
          <div className="flex-1">
            <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  const handleBack = () => {
    if (view === 'services') {
      setView('vendors');
      setSelectedVendor(null);
    } else {
      onBack();
    }
  };

  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1">
          <h2 className="text-gray-900">{view === 'vendors' ? problemTitle : selectedVendor?.vendorName}</h2>
          <p className="text-sm text-gray-500">
            {view === 'vendors'
              ? `${sortedVendors.length} provider${sortedVendors.length !== 1 ? 's' : ''} available`
              : `${sortedServiceRows.length} service${sortedServiceRows.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {[
          { value: 'relevance', label: 'Most Relevant' },
          { value: 'rating', label: 'Top Rated' },
          { value: 'price', label: 'Price: Low to High' },
          { value: 'distance', label: 'Nearest' },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setSortBy(option.value as 'relevance' | 'price' | 'rating' | 'distance')}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
              sortBy === option.value
                ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {view === 'vendors' && (
        <div className="space-y-4">
          {sortedVendors.map((vendor) => (
            <Card
              key={vendor.vendorId}
              className="rounded-xl hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedVendor(vendor);
                setView('services');
              }}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
                    {vendor.photo ? (
                      <img src={vendor.photo} alt={vendor.vendorName} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-gray-900 font-semibold line-clamp-2">{vendor.vendorName}</h3>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                    <p className="text-sm text-gray-500 mb-2">
                      {vendor.serviceCount} service{vendor.serviceCount !== 1 ? 's' : ''}
                      {vendor.specializations.length > 0 ? ` · ${vendor.specializations.slice(0, 2).join(', ')}` : ''}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <StarRating
                        rating={vendor.rating}
                        reviewCount={vendor.reviewCount}
                        textClassName="text-xs text-gray-500"
                      />
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {vendor.distanceFormatted}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-orange-600 font-semibold">From ₹{vendor.minPrice.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {view === 'services' && selectedVendor && (
        <div className="space-y-4">
          {sortedServiceRows.map((row, idx) => {
            const svc = rowToService(row);
            return (
              <Card
                key={`${svc.serviceId}-${idx}`}
                className="rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onServiceSelect(svc)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {svc.imageUrl && (
                      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                        <img src={svc.imageUrl} alt={svc.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-gray-900 line-clamp-1">{svc.name}</h3>
                      </div>
                      <div onClick={(e) => e.stopPropagation()} className="mb-3">
                        <ServiceDescriptionInline
                          description={svc.description}
                          title={svc.name}
                          className="m-0 text-sm leading-5 text-gray-600"
                        />
                      </div>
                      <div className="flex items-center gap-4 mb-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {svc.duration} min
                        </span>
                        {svc.distance !== undefined && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {Number(svc.distance || 0).toFixed(1)} km
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-900 font-medium">₹{svc.price.toLocaleString('en-IN')}</span>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {view === 'vendors' && sortedVendors.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-gray-900 mb-2">No providers found</h3>
          <p className="text-sm text-gray-500 mb-4">We couldn't find any providers for this problem in your area.</p>
          <Button variant="outline" onClick={onBack} className="border-orange-500 text-orange-500 hover:bg-orange-50">
            Go back
          </Button>
        </div>
      )}
    </div>
  );
}
