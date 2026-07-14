'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
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
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { formatDistanceDisplay } from '@/lib/distance-display';
import { CachedImage } from '@/components/shared/CachedImage';

interface UniversalVendorListViewProps {
  roleId: string;
  roleName: string;
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function UniversalVendorListView({ roleId, roleName, phone, onBack, onNavigate }: UniversalVendorListViewProps) {
  // Search state
  const [searchType, setSearchType] = useState<'staff' | 'centers'>('centers');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Results
  const [staff, setStaff] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  
  // User location
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);


  useEffect(() => {
    // Prefer persisted customer coordinates so distance renders for every center
    // even when the browser blocks geolocation. Fall back to a live position
    // request when no cached value is available.
    try {
      if (typeof window !== 'undefined') {
        const cachedLat = window.localStorage.getItem('customer_latitude');
        const cachedLng = window.localStorage.getItem('customer_longitude');
        if (cachedLat && cachedLng) {
          const lat = parseFloat(cachedLat);
          const lng = parseFloat(cachedLng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setUserLocation({ lat, lon: lng });
            return;
          }
        }
      }
    } catch {
      /* ignore */
    }
    const { getCurrentPositionSafe } = require('@/lib/geolocation-utils');
    getCurrentPositionSafe((coords: { lat: number; lng: number }) =>
      setUserLocation({ lat: coords.lat, lon: coords.lng })
    );
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
      toast.error('Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    try {
      const params = new URLSearchParams({
        roleId: roleId,
        query: searchQuery,
        serviceStyle: 'at_center' // Default, can be adjusted
      });

      if (userLocation) {
        // Send canonical names + legacy aliases so every backend revision
        // can locate the customer reference point.
        params.append('latitude', userLocation.lat.toString());
        params.append('longitude', userLocation.lon.toString());
        params.append('lat', userLocation.lat.toString());
        params.append('lon', userLocation.lon.toString());
      }
      if (phone) params.append('customerPhone', phone);

      // Use vendor search endpoint
      const data = await apiClient.get<{ doctors?: any[]; vendors?: any[]; success?: boolean }>(
        `/customer/vendors/search?${params.toString()}`
      );
      
      if (data.success !== false) {
        setStaff(data.doctors || data.vendors || []);
        setTotalResults((data.doctors || data.vendors || []).length);
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
        // Send canonical names + legacy aliases so every backend revision
        // can locate the customer reference point.
        params.append('latitude', userLocation.lat.toString());
        params.append('longitude', userLocation.lon.toString());
        params.append('lat', userLocation.lat.toString());
        params.append('lon', userLocation.lon.toString());
      }
      if (phone) params.append('customerPhone', phone);

      const data = await apiClient.get<{ clinics?: any[]; vendors?: any[]; success?: boolean }>(
        `/customer/vendors/search?${params.toString()}`
      );
      
      if (data.success !== false) {
        setCenters(data.clinics || (data as any).vendors || []);
        setTotalResults((data.clinics || (data as any).vendors || []).length);
      }
    } catch (error) {
      console.error('Error searching centers:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Find {roleName}</h1>
            <p className="text-xs text-gray-500">
              {totalResults} available near you
            </p>
          </div>
        </div>

        {/* Search Type Toggle */}
        <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-xl border border-gray-200">
          <button
            onClick={() => setSearchType('centers')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
              searchType === 'centers'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>Centers</span>
            </div>
          </button>
          <button
            onClick={() => setSearchType('staff')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
              searchType === 'staff'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
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
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder={`Search ${roleName.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 h-10 rounded-xl bg-gray-50 border-gray-200 text-sm focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="px-6 py-6 min-h-[calc(100vh-200px)] bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {searchType === 'staff' ? (
              staff.length === 0 ? (
                <EmptyState message="No staff found" />
              ) : (
                staff.map((person) => (
                  <Card
                    key={person.id}
                    onClick={() => onNavigate('staff_details', person)}
                    className="p-4 border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer rounded-xl bg-white"
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        {person.photo ? (
                          <CachedImage src={person.photo} alt={person.name} className="w-14 h-14 rounded-full object-cover" />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                            <UserCircle2 className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 truncate">{person.name}</h3>
                        <p className="text-xs text-gray-500 truncate">{roleName}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <div className="flex items-center gap-1 text-xs font-medium">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            {person.rating}
                          </div>
                          {formatDistanceDisplay(person) && (
                            <span className="text-xs text-gray-500">• {formatDistanceDisplay(person)}</span>
                          )}
                          {(person as any).hasActivePackage && (
                            <Badge variant="outline" className="text-[10px] border-[#FF8C42]/50 text-[#FF8C42] bg-orange-50">
                              Package active
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )
            ) : (
              centers.length === 0 ? (
                <EmptyState message="No centers found" />
              ) : (
                centers.map((center) => (
                  <Card
                    key={center.id}
                    onClick={() => onNavigate('vendor_profile', center)}
                    className="p-4 border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer rounded-xl bg-white"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-gray-900">{center.name}</h3>
                        <p className="text-xs text-gray-500 line-clamp-1">{center.address}</p>
                      </div>
                      {center.rating > 0 && (
                        <Badge variant="secondary" className="flex gap-1 items-center bg-green-50 text-green-700 hover:bg-green-100">
                          {center.rating} <Star className="w-3 h-3 fill-green-700" />
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin className="w-3 h-3" />
                        {formatDistanceDisplay(center) || center.city}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(center as any).hasActivePackage && (
                          <Badge variant="outline" className="text-[10px] border-[#FF8C42]/50 text-[#FF8C42] bg-orange-50">
                            Package active
                          </Badge>
                        )}
                        {center.isVerified && (
                          <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50">
                            Verified
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <Search className="w-12 h-12 mx-auto text-gray-300 mb-3" />
      <p className="text-gray-500 font-medium">{message}</p>
      <p className="text-xs text-gray-400 mt-1">Try adjusting your search</p>
    </div>
  );
}
