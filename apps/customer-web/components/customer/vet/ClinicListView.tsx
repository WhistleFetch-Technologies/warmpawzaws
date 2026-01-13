"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Star, MapPin, Clock, Filter, Search, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface ClinicListViewProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

interface Clinic {
  id: string;
  name: string;
  address: string;
  rating: number;
  review_count: number;
  distance?: string;
  timing: string;
  services: string[];
  price_range: string;
  is_open?: boolean;
}

export function ClinicListView({ phone, onBack, onNavigate }: ClinicListViewProps) {
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'rating' | 'distance' | 'price'>('all');

  useEffect(() => {
    loadClinics();
  }, []);

  const loadClinics = async () => {
    try {
      setLoading(true);
      try {
        const response = await apiClient.get('/vendors?role=veterinary_clinic') as any;
        if (response.vendors && response.vendors.length > 0) {
          setClinics(response.vendors.map((v: any) => ({
            id: v.id,
            name: v.business_name || v.name,
            address: v.address || 'Location available on booking',
            rating: v.rating || 4.5,
            review_count: v.review_count || 0,
            distance: v.distance || '2.5 km',
            timing: v.timing || '9 AM - 8 PM',
            services: v.services?.map((s: any) => s.name) || ['General Consultation', 'Vaccination'],
            price_range: v.price_range || '₹399 - ₹2999',
            is_open: true,
          })));
          return;
        }
      } catch (err) {
        console.log('Using mock data for clinics');
      }

      // Mock data
      setClinics([
        {
          id: '1',
          name: 'PetCare Veterinary Clinic',
          address: 'Linking Road, Bandra West',
          rating: 4.8,
          review_count: 156,
          distance: '1.2 km',
          timing: '9 AM - 8 PM',
          services: ['General', 'Surgery', 'Dental', 'Lab'],
          price_range: '₹399 - ₹2999',
          is_open: true,
        },
        {
          id: '2',
          name: 'Happy Paws Animal Hospital',
          address: 'Hill Road, Bandra',
          rating: 4.6,
          review_count: 89,
          distance: '2.1 km',
          timing: '8 AM - 10 PM',
          services: ['General', 'Emergency', 'Vaccination'],
          price_range: '₹299 - ₹1999',
          is_open: true,
        },
        {
          id: '3',
          name: 'VetLife Clinic',
          address: 'Turner Road, Bandra',
          rating: 4.5,
          review_count: 67,
          distance: '3.4 km',
          timing: '10 AM - 7 PM',
          services: ['General', 'Grooming', 'Pharmacy'],
          price_range: '₹349 - ₹1499',
          is_open: false,
        },
        {
          id: '4',
          name: 'Pet Wellness Center',
          address: 'SV Road, Santacruz',
          rating: 4.7,
          review_count: 112,
          distance: '4.0 km',
          timing: '24 Hours',
          services: ['Emergency', 'ICU', 'Surgery', 'Lab'],
          price_range: '₹499 - ₹5999',
          is_open: true,
        },
      ]);
    } catch (error) {
      console.error('Error loading clinics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewClinic = (clinicId: string) => {
    onNavigate('clinic-profile', { clinicId });
  };

  const filteredClinics = clinics.filter(clinic =>
    clinic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    clinic.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedClinics = [...filteredClinics].sort((a, b) => {
    switch (selectedFilter) {
      case 'rating':
        return b.rating - a.rating;
      case 'distance':
        return parseFloat(a.distance || '0') - parseFloat(b.distance || '0');
      case 'price':
        return parseInt(a.price_range.replace(/[^0-9]/g, '')) - parseInt(b.price_range.replace(/[^0-9]/g, ''));
      default:
        return 0;
    }
  });

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'rating', label: 'Top Rated' },
    { id: 'distance', label: 'Nearest' },
    { id: 'price', label: 'Price' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold">Veterinary Clinics</h1>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search clinics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id as any)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedFilter === filter.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
          </div>
        ) : sortedClinics.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🏥</div>
            <p className="text-gray-600">No clinics found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your search</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{sortedClinics.length} clinics found</p>
            
            {sortedClinics.map((clinic) => (
              <button
                key={clinic.id}
                onClick={() => handleViewClinic(clinic.id)}
                className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left"
              >
                <div className="flex gap-3">
                  {/* Clinic Icon */}
                  <div className="w-16 h-16 rounded-xl bg-purple-100 flex items-center justify-center text-2xl flex-shrink-0">
                    🏥
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{clinic.name}</h3>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="font-medium text-sm">{clinic.rating}</span>
                      <span className="text-gray-400 text-sm">({clinic.review_count})</span>
                      <span className="text-gray-300">•</span>
                      <span className="text-sm text-gray-500">{clinic.distance}</span>
                    </div>
                    
                    <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{clinic.address}</span>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-500">{clinic.timing}</span>
                        {clinic.is_open !== undefined && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${
                            clinic.is_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {clinic.is_open ? 'Open' : 'Closed'}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-orange-600">{clinic.price_range}</span>
                    </div>

                    {/* Service Tags */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {clinic.services.slice(0, 3).map((service, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
                          {service}
                        </span>
                      ))}
                      {clinic.services.length > 3 && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
                          +{clinic.services.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
