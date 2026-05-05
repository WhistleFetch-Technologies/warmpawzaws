'use client';

/**
 * ✨ ENHANCED VENDOR DISCOVERY BY PROBLEM
 * 
 * Universal discovery component that intelligently displays:
 * - For VETS: Both individual doctors AND clinics
 * - For OTHERS: Only centers (no individual staff)
 * 
 * Features:
 * - Proper entity type handling (staff vs center)
 * - Appropriate booking flows for each entity type
 * - Unified list view with clear differentiation
 * - Muted, professional design (no bright colors)
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Star, Phone, User, Building2, ChevronRight, Home, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { formatRatingNumberOrDash } from '@/lib/rating-display';
import { formatDistanceDisplay } from '@/lib/distance-display';

interface EnhancedVendorDiscoveryByProblemProps {
  roleId: string;
  roleName: string;
  problem: any;
  onBack: () => void;
  onEntitySelect: (entity: any, entityType: 'staff' | 'center') => void;
  customerId: string;
  phone: string;
  location?: { lat: number; lng: number };
}

export function EnhancedVendorDiscoveryByProblem({
  roleId,
  roleName,
  problem,
  onBack,
  onEntitySelect,
  customerId,
  phone,
  location
}: EnhancedVendorDiscoveryByProblemProps) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleConfig, setRoleConfig] = useState<any>(null);
  const [filterType, setFilterType] = useState<'all' | 'staff' | 'center'>('all');

  useEffect(() => {
    loadResults();
  }, [problem]);

  const loadResults = async () => {
    try {
      setLoading(true);
      
      if (!problem || !problem.id) {
        console.error('❌ Invalid problem object:', problem);
        setLoading(false);
        return;
      }
      
      console.log(`🔍 [ENHANCED DISCOVERY] Discovering for problem:`, {
        problemId: problem.id,
        problemName: problem.name,
        roleId
      });

      const params = new URLSearchParams({
        problemId: problem.id,
        roleId: roleId,
      });
      if (location) {
        params.append('lat', location.lat.toString());
        params.append('lng', location.lng.toString());
        params.append('radius', '50');
      }

      const data = await apiClient.get<{ results?: any[], roleConfig?: any }>(`/customer/vendors/discover-by-problem?${params.toString()}`);
      console.log('✅ Discovered results:', data);
      setResults(data.results || []);
      setRoleConfig(data.roleConfig);
    } catch (error) {
      console.error('Error discovering:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServiceStyleIcon = (style: string) => {
    switch (style) {
      case 'at_center':
      case 'at-center':
        return <Building2 className="w-3.5 h-3.5" />;
      case 'at_home':
      case 'at-home':
        return <Home className="w-3.5 h-3.5" />;
      case 'tele':
      case 'teleconsultation':
        return <Video className="w-3.5 h-3.5" />;
      default:
        return <Building2 className="w-3.5 h-3.5" />;
    }
  };

  const getServiceStyleLabel = (style: string) => {
    switch (style) {
      case 'at_center':
      case 'at-center':
        return 'At Center';
      case 'at_home':
      case 'at-home':
        return 'At Home';
      case 'tele':
      case 'teleconsultation':
        return 'Tele';
      default:
        return style;
    }
  };

  const filteredResults = results.filter(result => {
    if (filterType === 'all') return true;
    return result.entityType === filterType;
  });

  const staffCount = results.filter(r => r.entityType === 'staff').length;
  const centerCount = results.filter(r => r.entityType === 'center').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Status Bar */}
      <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
        <span className="text-sm">09:41</span>
        <div className="flex gap-1 items-center">
          <div className="w-4 h-3 bg-black/30 rounded-sm"></div>
          <div className="w-4 h-3 bg-black/30 rounded-sm"></div>
          <div className="w-6 h-3 bg-black/30 rounded-sm"></div>
        </div>
      </div>

      {/* Header */}
      <div className={`bg-gradient-to-br ${problem.gradient} px-6 pt-4 pb-8`}>
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-white flex-1 ml-4 line-clamp-1 text-lg">
            {problem.displayName || problem.name}
          </h1>
        </div>

        {/* Problem Badge */}
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm">
            {problem.icon}
          </div>
          <div className="flex-1">
            <h2 className="text-white text-sm">{problem.description}</h2>
            <p className="text-white/80 text-xs mt-1">
              {filteredResults.length} {filteredResults.length === 1 ? 'result' : 'results'} available
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24">
        {/* Filter Tabs (only show if role supports both) */}
        {roleConfig?.showIndividualStaff && roleConfig?.showCenters && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setFilterType('all')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all shadow-sm ${
                filterType === 'all'
                  ? 'bg-[#FF8C42] text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({results.length})
            </button>
            <button
              onClick={() => setFilterType('staff')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all shadow-sm ${
                filterType === 'staff'
                  ? 'bg-[#FF8C42] text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Doctors ({staffCount})
            </button>
            <button
              onClick={() => setFilterType('center')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all shadow-sm ${
                filterType === 'center'
                  ? 'bg-[#FF8C42] text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Centers ({centerCount})
            </button>
          </div>
        )}

        {/* Results List */}
        {filteredResults.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">😔</span>
            </div>
            <h3 className="text-gray-900 mb-2">No Results Found</h3>
            <p className="text-sm text-gray-500 mb-4">
              We couldn't find any specialists for {problem.displayName} in your area.
            </p>
            <Button 
              onClick={onBack}
              className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
            >
              Try Another Category
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredResults.map((result, index) => (
              <div
                key={`${result.entityType}-${result.entityId}-${index}`}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {/* Entity Header */}
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {/* Photo/Avatar */}
                    {result.photo ? (
                      <img
                        src={result.photo}
                        alt={result.name}
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-gray-200"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                        {result.entityType === 'staff' ? (
                          <User className="w-7 h-7" />
                        ) : (
                          <Building2 className="w-7 h-7" />
                        )}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      {/* Entity Type Badge */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                          result.entityType === 'staff' 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {result.entityType === 'staff' ? '👨‍⚕️ Doctor' : '🏥 Center'}
                        </span>
                      </div>
                      
                      {/* Name */}
                      <h3 className="text-gray-900 mb-1 line-clamp-1">
                        {result.name}
                      </h3>
                      
                      {/* Rating & Distance */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span className="text-sm font-medium text-gray-700">{formatRatingNumberOrDash(result.rating)}</span>
                        </div>
                        {formatDistanceDisplay(result) && (
                          <>
                            <span className="text-gray-300">•</span>
                            <div className="flex items-center gap-1 text-gray-500">
                              <MapPin className="w-3.5 h-3.5" />
                              <span className="text-xs">{formatDistanceDisplay(result)}</span>
                            </div>
                          </>
                        )}
                        {result.experience && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="text-xs text-gray-500">{result.experience}</span>
                          </>
                        )}
                      </div>
                      
                      {/* Location */}
                      {result.entityType === 'staff' && result.centerName && (
                        <p className="text-xs text-gray-500 line-clamp-1 mb-1">
                          🏥 {result.centerName}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 line-clamp-1">
                        📍 {result.address || result.centerAddress || 'Address not available'}
                      </p>
                    </div>
                  </div>

                  {/* Specializations (for staff) */}
                  {result.entityType === 'staff' && result.specializations && result.specializations.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {result.specializations.slice(0, 3).map((spec: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-lg border border-green-200"
                        >
                          {spec}
                        </span>
                      ))}
                      {result.specializations.length > 3 && (
                        <span className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded-lg border border-gray-200">
                          +{result.specializations.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Service Styles */}
                  {result.serviceStyles && result.serviceStyles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {result.serviceStyles.map((style: string) => (
                        <div
                          key={style}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          {getServiceStyleIcon(style)}
                          <span className="text-xs font-medium text-gray-700">
                            {getServiceStyleLabel(style)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Consultation Fee */}
                  {result.consultationFee && (
                    <div className="flex items-center justify-between py-2 px-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div>
                        <p className="text-xs text-blue-900 font-medium">
                          Consultation Fee
                        </p>
                        <p className="text-sm font-semibold text-blue-700">
                          ₹{result.consultationFee}
                        </p>
                      </div>
                      {result.entityType === 'center' && result.staffCount > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-blue-600">
                            {result.staffCount} {result.staffCount === 1 ? 'specialist' : 'specialists'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-gray-300"
                      onClick={() => {
                        if (result.phone) {
                          window.location.href = `tel:${result.phone}`;
                        }
                      }}
                    >
                      <Phone className="w-4 h-4 mr-1" />
                      Call
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
                      onClick={() => onEntitySelect(result, result.entityType)}
                    >
                      Book Now
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Home Indicator */}
      <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
        <div className="w-32 h-1 bg-black/20 rounded-full"></div>
      </div>
    </div>
  );
}
