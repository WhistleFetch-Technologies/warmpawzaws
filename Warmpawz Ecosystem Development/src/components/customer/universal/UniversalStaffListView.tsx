/**
 * ========================================
 * UNIVERSAL STAFF LIST VIEW
 * ========================================
 * 
 * Works for ALL vendor types with role-based labels:
 * - Veterinarians → "Doctors"
 * - Pet Groomers → "Groomers"  
 * - Pet Trainers → "Trainers"
 * - Dog Walkers → "Walkers"
 * - Pet Behaviourists → "Behaviourists"
 * 
 * Features:
 * - Dynamic API calls based on serviceCategory
 * - Role-based UI labels and icons
 * - Consistent filtering and search
 * - Unified profile navigation
 */

import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import {
  ArrowLeft,
  Search,
  Star,
  MapPin,
  Filter,
  X,
  Stethoscope,
  Scissors,
  GraduationCap,
  Heart,
  Award,
  Clock
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface RoleConfig {
  serviceCategory: string; // grooming_services, veterinary_services, etc.
  roleId: string; // pet_groomer, veterinarian, etc.
  serviceStyle?: string; // at_center, at_home, tele (optional filter)
  labels: {
    plural: string; // "Groomers", "Doctors", "Trainers"
    singular: string; // "Groomer", "Doctor", "Trainer"
    centerType?: string; // "Grooming Center", "Veterinary Clinic"
  };
  icon: any; // Lucide icon component
  brandColor: string; // Tailwind color for accents
}

interface UniversalStaffListViewProps {
  phone: string;
  roleConfig: RoleConfig;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

interface StaffMember {
  id: string;
  name: string;
  fullName: string;
  photo: string | null;
  specialization: string;
  degree: string;
  experience: number;
  consultationFee: number;
  rating: number;
  reviewCount: number;
  clinicName: string;
  clinicAddress: string;
  serviceCount: number;
  nextAvailable: any;
  isAvailableToday: boolean;
}

export function UniversalStaffListView({
  phone,
  roleConfig,
  onBack,
  onNavigate
}: UniversalStaffListViewProps) {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<StaffMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [maxFee, setMaxFee] = useState<number>(5000);
  const [minRating, setMinRating] = useState<number>(0);
  const [availableToday, setAvailableToday] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'fee_low' | 'fee_high' | 'rating' | 'experience'>('relevance');

  const API_BASE = getApiBaseUrl();
  const Icon = roleConfig.icon;

  useEffect(() => {
    loadStaff();
  }, [roleConfig.serviceCategory, roleConfig.serviceStyle]);

  useEffect(() => {
    applyFilters();
  }, [staff, searchQuery, maxFee, minRating, availableToday, sortBy]);

  const loadStaff = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams({
        serviceCategory: roleConfig.serviceCategory,
        limit: '50',
        sortBy
      });
      
      if (roleConfig.serviceStyle) {
        params.append('serviceStyle', roleConfig.serviceStyle);
      }
      
      if (roleConfig.roleId) {
        params.append('roleId', roleConfig.roleId);
      }

      console.log(`📍 [UNIVERSAL-LIST] Loading ${roleConfig.labels.plural}...`);
      console.log(`   Service Category: ${roleConfig.serviceCategory}`);
      console.log(`   Service Style: ${roleConfig.serviceStyle || 'all'}`);
      console.log(`   Role ID: ${roleConfig.roleId}`);
      
      // Use universal search API
      const response = await fetch(
        `${API_BASE}/universal/search?${params.toString()}`,
        {
          headers: {
            ...getAuthHeaders()
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ [UNIVERSAL-LIST] Loaded ${data.results?.length || 0} ${roleConfig.labels.plural}`);
        
        if (data.success && data.results) {
          setStaff(data.results);
        } else {
          setStaff([]);
        }
      } else {
        console.error(`❌ [UNIVERSAL-LIST] Failed to load ${roleConfig.labels.plural}:`, response.status);
        setStaff([]);
      }
    } catch (error) {
      console.error(`❌ [UNIVERSAL-LIST] Error:`, error);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let results = [...staff];

    // Search filter
    if (searchQuery && searchQuery.length > 0) {
      const query = searchQuery.toLowerCase();
      results = results.filter((s: StaffMember) =>
        s.name?.toLowerCase().includes(query) ||
        s.specialization?.toLowerCase().includes(query) ||
        s.clinicName?.toLowerCase().includes(query)
      );
    }

    // Fee filter
    results = results.filter((s: StaffMember) => s.consultationFee <= maxFee);

    // Rating filter
    results = results.filter((s: StaffMember) => s.rating >= minRating);

    // Available today filter
    if (availableToday) {
      results = results.filter((s: StaffMember) => s.isAvailableToday);
    }

    // Sort
    switch (sortBy) {
      case 'fee_low':
        results.sort((a, b) => a.consultationFee - b.consultationFee);
        break;
      case 'fee_high':
        results.sort((a, b) => b.consultationFee - a.consultationFee);
        break;
      case 'rating':
        results.sort((a, b) => b.rating - a.rating);
        break;
      case 'experience':
        results.sort((a, b) => b.experience - a.experience);
        break;
      case 'relevance':
      default:
        // Already sorted by API
        break;
    }

    setFilteredStaff(results);
  };

  const clearFilters = () => {
    setMaxFee(5000);
    setMinRating(0);
    setAvailableToday(false);
    setSortBy('relevance');
  };

  const StaffCard = ({ member }: { member: StaffMember }) => (
    <Card
      onClick={() => onNavigate('staff_profile', { staffId: member.id, staff: member })}
      className="p-4 hover:shadow-lg transition-all cursor-pointer border border-gray-200"
    >
      <div className="flex gap-4">
        {/* Photo */}
        <div className="relative flex-shrink-0">
          {member.photo ? (
            <img
              src={member.photo}
              alt={member.name}
              className="w-20 h-20 rounded-xl object-cover"
            />
          ) : (
            <div className={`w-20 h-20 rounded-xl bg-gradient-to-br ${roleConfig.brandColor} flex items-center justify-center`}>
              <Icon className="w-10 h-10 text-white" />
            </div>
          )}
          {member.isAvailableToday && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
              <Clock className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 truncate">{member.name}</h3>
              {member.specialization && (
                <p className="text-sm text-gray-600 truncate">{member.specialization}</p>
              )}
              {member.degree && (
                <p className="text-xs text-gray-500 truncate">{member.degree}</p>
              )}
            </div>
          </div>

          {/* Rating & Experience */}
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
              <span className="font-semibold text-sm">{member.rating.toFixed(1)}</span>
              <span className="text-xs text-gray-500">({member.reviewCount})</span>
            </div>
            {member.experience > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-xs text-gray-600">{member.experience}+ years</span>
              </>
            )}
          </div>

          {/* Clinic */}
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate">{member.clinicName}</span>
          </div>

          {/* Services */}
          {member.serviceCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {member.serviceCount} services
            </Badge>
          )}
        </div>

        {/* Fee */}
        <div className="flex flex-col items-end justify-between">
          <div className="text-right">
            <div className={`font-bold text-lg text-[${roleConfig.brandColor}]`}>₹{member.consultationFee}</div>
            <div className="text-xs text-gray-500">consultation</div>
          </div>
          {member.nextAvailable && (
            <Badge className="bg-green-100 text-green-700 border-none text-xs">
              {member.nextAvailable.isToday ? 'Today' : member.nextAvailable.isTomorrow ? 'Tomorrow' : 'Available'}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading {roleConfig.labels.plural.toLowerCase()}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className={`bg-gradient-to-br ${roleConfig.brandColor} text-white px-6 pt-8 pb-6 sticky top-0 z-10 shadow-md`}>
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <Icon className="w-7 h-7" />
          <div>
            <h1 className="text-2xl font-bold">{roleConfig.labels.plural}</h1>
            <p className="text-white/80 text-sm">{filteredStaff.length} available</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={`Search ${roleConfig.labels.plural.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-lg border-none text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-white/20"
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white px-6 py-3 border-b border-gray-200 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          Filters
        </Button>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#FF8C42]"
        >
          <option value="relevance">Relevance</option>
          <option value="rating">Top Rated</option>
          <option value="fee_low">Fee: Low to High</option>
          <option value="fee_high">Fee: High to Low</option>
          <option value="experience">Most Experienced</option>
        </select>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Filters</h3>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          </div>

          {/* Available Today */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={availableToday}
              onChange={(e) => setAvailableToday(e.target.checked)}
              className="rounded border-gray-300 text-[#FF8C42] focus:ring-[#FF8C42]"
            />
            <span className="text-sm">Available Today</span>
          </label>

          {/* Max Fee */}
          <div>
            <label className="text-sm font-medium mb-2 block">Max Fee: ₹{maxFee}</label>
            <input
              type="range"
              min="0"
              max="5000"
              step="100"
              value={maxFee}
              onChange={(e) => setMaxFee(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Min Rating */}
          <div>
            <label className="text-sm font-medium mb-2 block">Min Rating: {minRating}+</label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              value={minRating}
              onChange={(e) => setMinRating(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Staff List */}
      <div className="p-4 space-y-3 pb-20">
        {filteredStaff.length > 0 ? (
          filteredStaff.map((member) => (
            <StaffCard key={member.id} member={member} />
          ))
        ) : (
          <div className="text-center py-12">
            <Icon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No {roleConfig.labels.plural.toLowerCase()} found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}