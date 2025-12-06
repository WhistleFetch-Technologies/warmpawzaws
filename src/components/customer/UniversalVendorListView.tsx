import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Card } from '../../ui/card';
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
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

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

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

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
        params.append('lat', userLocation.lat.toString());
        params.append('lon', userLocation.lon.toString());
      }

      // Reusing doctor search endpoint which is generic enough
      const response = await fetch(
        `${API_BASE}/customer/doctors/search?${params.toString()}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStaff(data.doctors || []);
          setTotalResults(data.doctors?.length || 0);
        }
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

      const response = await fetch(
        `${API_BASE}/customer/clinics/search?${params.toString()}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCenters(data.clinics || []);
          setTotalResults(data.clinics?.length || 0);
        }
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
                          <img src={person.photo} alt={person.name} className="w-14 h-14 rounded-full object-cover" />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                            <UserCircle2 className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 truncate">{person.name}</h3>
                        <p className="text-xs text-gray-500 truncate">{person.specialization || roleName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1 text-xs font-medium">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            {person.rating}
                          </div>
                          {person.distance && (
                            <span className="text-xs text-gray-500">• {person.distance} km</span>
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
                        {center.distance ? `${center.distance} km away` : center.city}
                      </div>
                      {center.isVerified && (
                        <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50">
                          Verified
                        </Badge>
                      )}
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
