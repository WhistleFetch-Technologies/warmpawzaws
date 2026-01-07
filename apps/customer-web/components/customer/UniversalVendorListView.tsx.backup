'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  SlidersHorizontal,
  MapPin,
  Star,
  Clock,
  Navigation,
  X,
  Loader2,
  UserCircle2,
  Building2
} from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { UniversalVendorCard } from './UniversalVendorCard';

interface UniversalVendorListViewProps {
  roleId: string;
  roleName: string;
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function UniversalVendorListView({ roleId, roleName, phone, onBack, onNavigate }: UniversalVendorListViewProps) {
  const [searchType, setSearchType] = useState<'staff' | 'centers'>('centers');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [staff, setStaff] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => console.log('Location access denied or unavailable')
      );
    }
  }, []);

  useEffect(() => {
    loadResults();
  }, [searchType, roleId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadResults();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadResults = async () => {
    try {
      setLoading(true);
      if (searchType === 'staff') {
        await loadStaff();
      } else {
        await loadCenters();
      }
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    try {
      const params = new URLSearchParams({
        roleId: roleId,
        query: searchQuery,
        serviceStyle: 'at_center'
      });

      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lon', userLocation.lon.toString());
      }

      const response = await apiClient.get<{ doctors: any[] }>(
        `/customer/doctors/search?${params}`
      );
      
      if (response.doctors) {
        setStaff(response.doctors);
        setTotalResults(response.doctors.length);
      }
    } catch (error) {
      console.error('Error searching staff:', error);
    }
  };

  const loadCenters = async () => {
    try {
      const params = new URLSearchParams({
        roleId: roleId,
        query: searchQuery
      });

      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lon', userLocation.lon.toString());
      }

      const response = await apiClient.get<{ clinics: any[] }>(
        `/customer/clinics/search?${params}`
      );
      
      if (response.clinics) {
        setCenters(response.clinics);
        setTotalResults(response.clinics.length);
      }
    } catch (error) {
      console.error('Error searching centers:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 pt-12 pb-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Find {roleName}</h1>
            <p className="text-sm text-gray-600">{totalResults} results</p>
          </div>
        </div>

        {/* Search Type Toggle */}
        <div className="flex gap-2 mb-4 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setSearchType('centers')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
              searchType === 'centers'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>Centers</span>
            </div>
          </button>
          <button
            onClick={() => setSearchType('staff')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
              searchType === 'staff'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <UserCircle2 className="w-4 h-4" />
              <span>Staff</span>
            </div>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder={`Search ${searchType === 'staff' ? 'staff' : 'centers'}...`}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : searchType === 'staff' && staff.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <p className="text-gray-600">No staff found</p>
          </div>
        ) : searchType === 'centers' && centers.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <p className="text-gray-600">No centers found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {searchType === 'staff' ? (
              staff.map((item) => (
                <UniversalVendorCard
                  key={item.id || item.staffId}
                  vendor={{
                    id: item.id || item.staffId,
                    vendorId: item.id || item.staffId,
                    vendorName: item.name || item.staffName,
                    vendorRating: item.rating,
                    vendorReviewCount: item.reviewCount,
                    vendorLocation: item.location?.address,
                    price: item.price,
                    duration: item.duration,
                    serviceName: item.specialization,
                    vendorProfileImage: item.profilePhoto
                  }}
                  onViewDetails={(id) => onNavigate('vendor_details', { vendorId: id })}
                  onBook={(id) => onNavigate('book_service', { vendorId: id })}
                />
              ))
            ) : (
              centers.map((item) => (
                <UniversalVendorCard
                  key={item.id || item.clinicId}
                  vendor={{
                    id: item.id || item.clinicId,
                    vendorId: item.id || item.clinicId,
                    vendorName: item.name || item.clinicName,
                    vendorRating: item.rating,
                    vendorReviewCount: item.reviewCount,
                    vendorLocation: item.location?.address,
                    price: item.price,
                    duration: item.duration,
                    serviceName: item.specialization,
                    vendorProfileImage: item.profilePhoto
                  }}
                  onViewDetails={(id) => onNavigate('vendor_details', { vendorId: id })}
                  onBook={(id) => onNavigate('book_service', { vendorId: id })}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

