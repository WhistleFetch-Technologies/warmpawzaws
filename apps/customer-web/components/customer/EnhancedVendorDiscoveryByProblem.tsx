'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Star, Filter, SlidersHorizontal, X } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { VendorDiscoveryByProblem } from './VendorDiscoveryByProblem';

interface EnhancedVendorDiscoveryByProblemProps {
  roleId: string;
  roleName: string;
  problem: any;
  onBack: () => void;
  onVendorSelect: (vendor: any, serviceStyle?: string) => void;
  customerId: string;
  phone: string;
  location?: { lat: number; lng: number };
}

export function EnhancedVendorDiscoveryByProblem({
  roleId,
  roleName,
  problem,
  onBack,
  onVendorSelect,
  customerId,
  phone,
  location
}: EnhancedVendorDiscoveryByProblemProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    sortBy: 'rating',
    minRating: '',
    maxPrice: '',
    serviceStyle: ''
  });

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header with Filters */}
      <div className="bg-gradient-to-r from-primary to-primary-dark px-6 pt-12 pb-6 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold">{problem.name || problem.title}</h1>
            <p className="text-white/90 text-sm">Enhanced search for {roleName}</p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <SlidersHorizontal className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, sortBy: e.target.value })}
                className="w-full px-4 py-2 bg-white rounded-xl focus:outline-none"
              >
                <option value="rating">Highest Rated</option>
                <option value="distance">Nearest</option>
                <option value="price">Price: Low to High</option>
                <option value="reviews">Most Reviews</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Min Rating</label>
              <select
                value={filters.minRating}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, minRating: e.target.value })}
                className="w-full px-4 py-2 bg-white rounded-xl focus:outline-none"
              >
                <option value="">All Ratings</option>
                <option value="4">4+ Stars</option>
                <option value="4.5">4.5+ Stars</option>
                <option value="5">5 Stars</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Service Style</label>
              <select
                value={filters.serviceStyle}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, serviceStyle: e.target.value })}
                className="w-full px-4 py-2 bg-white rounded-xl focus:outline-none"
              >
                <option value="">All Styles</option>
                <option value="at_home">At Home</option>
                <option value="at_center">At Center</option>
                <option value="tele">Teleconsultation</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Vendor Discovery Component */}
      <VendorDiscoveryByProblem
        roleId={roleId}
        roleName={roleName}
        problem={problem}
        onBack={onBack}
        onVendorSelect={onVendorSelect}
        customerId={customerId}
        phone={phone}
        location={location}
      />
    </div>
  );
}

