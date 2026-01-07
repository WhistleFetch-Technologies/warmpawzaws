'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Star, Phone, Clock, Building2, ChevronRight, User, Calendar } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface VendorDiscoveryByProblemProps {
  roleId: string;
  roleName: string;
  problem: any;
  onBack: () => void;
  onVendorSelect: (vendor: any, serviceStyle?: string) => void;
  customerId: string;
  phone: string;
  location?: { lat: number; lng: number };
}

export function VendorDiscoveryByProblem({
  roleId,
  roleName,
  problem,
  onBack,
  onVendorSelect,
  customerId,
  phone,
  location
}: VendorDiscoveryByProblemProps) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'vendors' | 'specialists'>('vendors');
  const [centers, setCenters] = useState<any[]>([]);
  const [individuals, setIndividuals] = useState<any[]>([]);
  const [displayMode, setDisplayMode] = useState<'staff_only' | 'center_only' | 'both'>('both');

  const getContextualLabels = () => {
    const normalizedRole = roleId.replace(/^role_/, '').replace(/^pet_/, '');
    
    const labelMap: Record<string, { centerLabel: string; staffLabel: string; centerIcon: string; staffIcon: string }> = {
      'veterinarian': { centerLabel: 'Clinics', staffLabel: 'Doctors', centerIcon: '🏥', staffIcon: '👨‍⚕️' },
      'vet_clinic': { centerLabel: 'Clinics', staffLabel: 'Doctors', centerIcon: '🏥', staffIcon: '👨‍⚕️' },
      'groomer': { centerLabel: 'Salons', staffLabel: 'Groomers', centerIcon: '💇', staffIcon: '✂️' },
      'grooming_center': { centerLabel: 'Salons', staffLabel: 'Groomers', centerIcon: '💇', staffIcon: '✂️' },
      'trainer': { centerLabel: 'Training Centers', staffLabel: 'Trainers', centerIcon: '🎓', staffIcon: '🏆' },
      'training_center': { centerLabel: 'Training Centers', staffLabel: 'Trainers', centerIcon: '🎓', staffIcon: '🏆' },
      'behaviourist': { centerLabel: 'Behavior Centers', staffLabel: 'Behaviorists', centerIcon: '🧠', staffIcon: '🎯' },
      'behaviorist': { centerLabel: 'Behavior Centers', staffLabel: 'Behaviorists', centerIcon: '🧠', staffIcon: '🎯' },
      'dog_walker': { centerLabel: '', staffLabel: 'Dog Walkers', centerIcon: '', staffIcon: '🦮' },
      'pet_walker': { centerLabel: '', staffLabel: 'Dog Walkers', centerIcon: '', staffIcon: '🦮' },
      'boarding': { centerLabel: 'Boarding Centers', staffLabel: '', centerIcon: '🏨', staffIcon: '' },
      'pet_boarding': { centerLabel: 'Boarding Centers', staffLabel: '', centerIcon: '🏨', staffIcon: '' },
      'boarding_center': { centerLabel: 'Boarding Centers', staffLabel: '', centerIcon: '🏨', staffIcon: '' },
    };
    
    return labelMap[normalizedRole] || { 
      centerLabel: 'Centers', 
      staffLabel: 'Specialists', 
      centerIcon: '🏢', 
      staffIcon: '👤' 
    };
  };

  const labels = getContextualLabels();
  const showCenterTab = displayMode === 'center_only' || displayMode === 'both';
  const showStaffTab = displayMode === 'staff_only' || displayMode === 'both';

  useEffect(() => {
    loadVendors();
  }, [problem]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      
      if (!problem || !problem.id) {
        console.error('Invalid problem object:', problem);
        setLoading(false);
        return;
      }
      
      if (problem.specialists && Array.isArray(problem.specialists)) {
        const mappedVendors = problem.specialists.map((specialist: any) => ({
          ...specialist,
          vendorId: specialist.clinicId,
          vendorName: specialist.clinicName,
          businessName: specialist.clinicName,
          vendorType: 'staff',
          specialists: [specialist],
          location: {
            address: specialist.clinicAddress
          }
        }));
        
        setVendors(mappedVendors);
        setCenters([]);
        setIndividuals(mappedVendors);
        setDisplayMode('staff_only');
        setLoading(false);
        return;
      }
      
      const problemParams = new URLSearchParams({
        problemGridId: problem.id,
        roleId: roleId,
        sortBy: 'rating',
        feeMin: '0',
        feeMax: '999999'
      });

      if (location) {
        problemParams.append('lat', location.lat.toString());
        problemParams.append('lon', location.lng.toString());
      }

      const response = await apiClient.get<{ 
        vendors: any[]; 
        centers: any[]; 
        individuals: any[];
        displayMode: 'staff_only' | 'center_only' | 'both';
      }>(
        `/customer/universal-problem-discovery?${problemParams}`
      );
      
      if (response.vendors) {
        setVendors(response.vendors);
        setCenters(response.centers || []);
        setIndividuals(response.individuals || []);
        setDisplayMode(response.displayMode || 'both');
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderVendorCard = (vendor: any) => (
    <div
      key={vendor.id || vendor.vendorId}
      onClick={() => onVendorSelect(vendor)}
      className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:border-primary hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
    >
      <div className="flex gap-4">
        {vendor.profilePhoto ? (
          <img
            src={vendor.profilePhoto}
            alt={vendor.businessName || vendor.vendorName}
            className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0">
            {(vendor.businessName || vendor.vendorName || 'V').charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 mb-1 truncate">
            {vendor.businessName || vendor.vendorName}
          </h3>
          {vendor.rating && (
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-semibold">{vendor.rating.toFixed(1)}</span>
              </div>
              {vendor.totalReviews && (
                <span className="text-sm text-gray-600">({vendor.totalReviews})</span>
              )}
            </div>
          )}
          {vendor.location?.address && (
            <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
              <MapPin className="w-4 h-4" />
              <span className="truncate">{vendor.location.address}</span>
            </div>
          )}
          {vendor.distance && (
            <div className="text-sm text-primary font-semibold">
              {vendor.distance.toFixed(1)} km away
            </div>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading vendors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
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
            <p className="text-white/90 text-sm">Find {roleName} for this concern</p>
          </div>
        </div>

        {/* Tabs */}
        {(showCenterTab && showStaffTab) && (
          <div className="flex gap-2 bg-white/20 backdrop-blur-sm rounded-xl p-1">
            <button
              onClick={() => setViewMode('vendors')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'vendors'
                  ? 'bg-white text-primary'
                  : 'text-white/90 hover:text-white'
              }`}
            >
              {labels.centerLabel || 'Centers'}
            </button>
            <button
              onClick={() => setViewMode('specialists')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'specialists'
                  ? 'bg-white text-primary'
                  : 'text-white/90 hover:text-white'
              }`}
            >
              {labels.staffLabel || 'Specialists'}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {viewMode === 'vendors' && centers.length > 0 ? (
          <div className="space-y-3">
            {centers.map((vendor) => renderVendorCard(vendor))}
          </div>
        ) : viewMode === 'specialists' && individuals.length > 0 ? (
          <div className="space-y-3">
            {individuals.map((vendor) => renderVendorCard(vendor))}
          </div>
        ) : vendors.length > 0 ? (
          <div className="space-y-3">
            {vendors.map((vendor) => renderVendorCard(vendor))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-12 text-center">
            <p className="text-gray-600">No vendors found for this problem</p>
            <p className="text-sm text-gray-500 mt-2">Try a different search</p>
          </div>
        )}
      </div>
    </div>
  );
}

