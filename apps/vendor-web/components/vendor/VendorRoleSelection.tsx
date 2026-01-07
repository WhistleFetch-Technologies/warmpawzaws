'use client';

import { ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiClient, isUatMode } from '@/lib/api-client';

interface VendorRoleSelectionProps {
  onRoleSelect: (role: string) => void;
}

interface Role {
  id: string;
  name: string;
  description: string;
  icon: string;
  features: string[];
  vendorTypes: string[];
  serviceStyles: string[];
  pricingControl: {
    canControlPrice: boolean;
    canControlDuration: boolean;
    priceRangeMin?: number | null;
    priceRangeMax?: number | null;
  };
  capabilities: string[];
  order: number;
  isActive: boolean;
}

// Default roles for UAT mode
const DEFAULT_ROLES: Role[] = [
  {
    id: 'service-provider',
    name: 'Pet Service Provider',
    description: 'Offer services like grooming, walking, training, boarding, sun-set services etc.',
    icon: 'service',
    features: ['📅 Bookings', '🏠 At Home / Clinic'],
    vendorTypes: ['service'],
    serviceStyles: ['at-home', 'clinic'],
    pricingControl: { canControlPrice: true, canControlDuration: true, priceRangeMin: 10, priceRangeMax: 100 },
    capabilities: ['📅 Bookings', '🏠 At Home / Clinic'],
    order: 1,
    isActive: true
  },
  {
    id: 'veterinarian',
    name: 'Veterinarian',
    description: 'Create Prescriptions, manage consultations',
    icon: 'healthcare',
    features: ['📋 Prescriptions', '💬 Consultations'],
    vendorTypes: ['healthcare'],
    serviceStyles: ['clinic'],
    pricingControl: { canControlPrice: true, canControlDuration: true, priceRangeMin: 50, priceRangeMax: 200 },
    capabilities: ['📋 Prescriptions', '💬 Consultations'],
    order: 2,
    isActive: true
  },
  {
    id: 'product-seller',
    name: 'Pet Product Seller',
    description: 'Sell products manage inventory, create promotions',
    icon: 'retail',
    features: ['📊 Excel Upload', '📍 20Lm Radius'],
    vendorTypes: ['retail'],
    serviceStyles: ['online'],
    pricingControl: { canControlPrice: true, canControlDuration: false, priceRangeMin: 5, priceRangeMax: 50 },
    capabilities: ['📊 Excel Upload', '📍 20Lm Radius'],
    order: 3,
    isActive: true
  }
];

export function VendorRoleSelection({ onRoleSelect }: VendorRoleSelectionProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      
      // UAT Mode: Use default roles
      if (isUatMode()) {
        console.log('🔧 [UAT Mode] Using default roles');
        setRoles(DEFAULT_ROLES);
        return;
      }

      const data = await apiClient.get<{ roles: Role[] }>('/config/roles');
      const activeRoles = data.roles.filter((role: Role) => role.isActive);
      const uniqueRoles = Array.from(new Map(activeRoles.map((r: Role) => [r.id, r])).values());
      setRoles(uniqueRoles as Role[]);
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError('Failed to load roles. Using defaults.');
      setRoles(DEFAULT_ROLES);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'service': 'green', 'service_provider': 'green', 'groomer': 'green', 'walker': 'green',
      'healthcare': 'blue', 'healthcare_provider': 'blue', 'clinic': 'blue',
      'retail': 'purple', 'seller': 'purple', 'pharmacy': 'teal',
      'boarding': 'orange', 'boarder': 'orange',
      'training': 'indigo', 'trainer': 'indigo',
      'photography': 'pink', 'photographer': 'pink'
    };
    return colors[category.toLowerCase()] || 'gray';
  };

  const getIconSvg = (category: string) => {
    const cat = category.toLowerCase();
    
    if (cat.includes('service') || cat === 'groomer' || cat === 'walker') {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 4L14 8L18 9L15 12L16 16L12 14L8 16L9 12L6 9L10 8L12 4Z" fill="white"/>
          <circle cx="12" cy="16" r="2" fill="white"/>
        </svg>
      );
    }
    
    if (cat.includes('healthcare') || cat.includes('vet') || cat === 'clinic') {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L12 10M12 10L8 10M12 10L16 10M12 10L12 18M8 10L8 6M16 10L16 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2"/>
        </svg>
      );
    }
    
    if (cat.includes('retail') || cat.includes('seller') || cat === 'pharmacy') {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="6" width="16" height="12" rx="2" stroke="white" strokeWidth="2"/>
          <path d="M8 6V4C8 3 9 2 10 2H14C15 2 16 3 16 4V6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="12" cy="13" r="2" fill="white"/>
        </svg>
      );
    }

    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2"/>
        <path d="M12 8V12L15 15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  };

  const getBorderColorClass = (color: string) => {
    const colors: Record<string, string> = {
      'green': 'border-green-200 bg-green-50 text-green-700',
      'blue': 'border-blue-200 bg-blue-50 text-blue-700',
      'purple': 'border-purple-200 bg-purple-50 text-purple-700',
      'orange': 'border-orange-200 bg-orange-50 text-orange-700',
      'indigo': 'border-indigo-200 bg-indigo-50 text-indigo-700',
      'pink': 'border-pink-200 bg-pink-50 text-pink-700',
      'teal': 'border-teal-200 bg-teal-50 text-teal-700',
      'gray': 'border-gray-200 bg-gray-50 text-gray-700'
    };
    return colors[color] || colors['gray'];
  };

  const getBackgroundColorClass = (color: string) => {
    const colors: Record<string, string> = {
      'green': 'bg-green-500', 'blue': 'bg-blue-500', 'purple': 'bg-purple-500',
      'orange': 'bg-orange-500', 'indigo': 'bg-indigo-500', 'pink': 'bg-pink-500',
      'teal': 'bg-teal-500', 'gray': 'bg-gray-500'
    };
    return colors[color] || colors['gray'];
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col w-full max-w-[430px] mx-auto">
      {/* Orange Top Section */}
      <div className="flex flex-col items-center pt-12 pb-0 px-0">
        <div className="mb-4 w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl">
          <img src="/logo.png" alt="Warmpawz" className="w-20 h-20 object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-black text-center">Choose Your Role</h1>
      </div>

      {/* White Bottom Section */}
      <div className="flex-1 bg-white rounded-t-[32px] px-4 py-0 overflow-y-auto shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        <p className="text-center text-gray-600 mb-4 text-sm">
          Join as a seller, veterinarian or service provider
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-0 mb-4">
            <p className="text-yellow-700 text-center text-xs">{error}</p>
          </div>
        ) : null}

        {/* Role Cards */}
        <div className="space-y-3 mb-0">
          {roles.map((role) => {
            const category = role.vendorTypes && role.vendorTypes.length > 0 ? role.vendorTypes[0] : 'service';
            const color = getCategoryColor(category);
            const bgColorClass = getBackgroundColorClass(color);
            const borderColorClass = getBorderColorClass(color);
            const displayBadges = role.features && role.features.length > 0 ? role.features : role.capabilities;
            
            return (
              <button
                key={role.id}
                onClick={() => onRoleSelect(role.id)}
                className="w-full bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-primary transition-all text-left group active:scale-[0.98] shadow-sm"
              >
                <div className="flex items-start gap-0">
                  <div className={`w-12 h-12 ${bgColorClass} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    {getIconSvg(category)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-gray-900 font-semibold text-sm mb-0">{role.name}</h3>
                    <p className="text-xs text-gray-500 mb-0 leading-tight line-clamp-0">
                      {role.description}
                    </p>
                    
                    {displayBadges && displayBadges.length > 0 && (
                      <div className="flex flex-wrap gap-0.5">
                        {displayBadges.slice(0, 2).map((badge, idx) => (
                          <span key={idx} className={`text-xs px-0 py-0.5 rounded-full border ${borderColorClass}`}>
                            {badge}
                          </span>
                        ))}
                        {displayBadges.length > 2 && (
                          <span className="text-xs px-0 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600">
                            +{displayBadges.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary flex-shrink-0 mt-0" />
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400 leading-tight px-4">
          Trusted by 15,000+ pet professionals worldwide<br />
          © 2025 WARMPAWZ Inc. All rights reserved
        </p>
      </div>
    </div>
  );
}

