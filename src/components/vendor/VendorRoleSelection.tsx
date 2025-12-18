import { ArrowRight } from 'lucide-react';
import logoImage from 'figma:asset/1ee3459260cb17d9119000df586f10f31d016a25.png';
import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Button } from '../ui/button';

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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch roles');
      }

      const data = await response.json();
      // Filter only active roles and Deduplicate
      const activeRoles = data.roles.filter((role: Role) => role.isActive);
      
      // Deduplicate by ID
      const uniqueRoles = Array.from(new Map(activeRoles.map((r: Role) => [r.id, r])).values());
      
      setRoles(uniqueRoles as Role[]);
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError('Failed to load roles. Please try again.');
      // Fallback to hardcoded roles for backward compatibility
      setRoles([
        {
          id: 'service-provider',
          name: 'Pet Service Provider',
          description: 'Offer services like grooming, walking, training, boarding, sun-set services etc.',
          icon: 'service',
          features: ['📅 Bookings', '🏠 At Home / Clinic'],
          vendorTypes: ['service'],
          serviceStyles: ['at-home', 'clinic'],
          pricingControl: {
            canControlPrice: true,
            canControlDuration: true,
            priceRangeMin: 10,
            priceRangeMax: 100
          },
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
          pricingControl: {
            canControlPrice: true,
            canControlDuration: true,
            priceRangeMin: 50,
            priceRangeMax: 200
          },
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
          pricingControl: {
            canControlPrice: true,
            canControlDuration: false,
            priceRangeMin: 5,
            priceRangeMax: 50
          },
          capabilities: ['📊 Excel Upload', '📍 20Lm Radius'],
          order: 3,
          isActive: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'service': 'green',
      'service_provider': 'green',
      'healthcare': 'blue',
      'healthcare_provider': 'blue',
      'retail': 'purple',
      'seller': 'purple',
      'boarding': 'orange',
      'training': 'indigo',
      'photography': 'pink',
      'pharmacy': 'teal',
      'groomer': 'green',
      'trainer': 'indigo',
      'walker': 'green',
      'boarder': 'orange',
      'photographer': 'pink',
      'clinic': 'blue'
    };
    return colors[category.toLowerCase()] || 'gray';
  };

  const getIconSvg = (category: string, color: string) => {
    const cat = category.toLowerCase();
    
    // Service Provider Icon
    if (cat.includes('service') || cat === 'groomer' || cat === 'walker') {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 4L14 8L18 9L15 12L16 16L12 14L8 16L9 12L6 9L10 8L12 4Z" fill="white"/>
          <circle cx="12" cy="16" r="2" fill="white"/>
        </svg>
      );
    }
    
    // Healthcare/Veterinarian Icon
    if (cat.includes('healthcare') || cat.includes('vet') || cat === 'clinic') {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L12 10M12 10L8 10M12 10L16 10M12 10L12 18M8 10L8 6M16 10L16 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2"/>
        </svg>
      );
    }
    
    // Retail/Product Seller Icon
    if (cat.includes('retail') || cat.includes('seller') || cat === 'pharmacy') {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="6" width="16" height="12" rx="2" stroke="white" strokeWidth="2"/>
          <path d="M8 6V4C8 3 9 2 10 2H14C15 2 16 3 16 4V6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="12" cy="13" r="2" fill="white"/>
        </svg>
      );
    }

    // Boarding Icon
    if (cat.includes('boarding') || cat === 'boarder') {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M3 9L12 2L21 9V20C21 21 20 22 19 22H5C4 22 3 21 3 20V9Z" stroke="white" strokeWidth="2"/>
          <circle cx="12" cy="14" r="2" fill="white"/>
        </svg>
      );
    }

    // Training Icon
    if (cat.includes('training') || cat === 'trainer') {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="2"/>
          <path d="M6 20C6 16 8 14 12 14C16 14 18 16 18 20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    }

    // Photography Icon
    if (cat.includes('photography') || cat === 'photographer') {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="6" width="20" height="14" rx="2" stroke="white" strokeWidth="2"/>
          <circle cx="12" cy="13" r="3" stroke="white" strokeWidth="2"/>
          <circle cx="18" cy="9" r="1" fill="white"/>
        </svg>
      );
    }

    // Default Icon
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
      'green': 'bg-green-500',
      'blue': 'bg-blue-500',
      'purple': 'bg-purple-500',
      'orange': 'bg-orange-500',
      'indigo': 'bg-indigo-500',
      'pink': 'bg-pink-500',
      'teal': 'bg-teal-500',
      'gray': 'bg-gray-500'
    };
    return colors[color] || colors['gray'];
  };

  return (
    <div className="min-h-screen bg-[#FF8C42] flex flex-col w-full max-w-[430px] mx-auto">
      {/* Status Bar */}
      <div className="px-6 pt-3 pb-2 flex justify-between items-center">
        <span className="text-black text-xs">09:41</span>
        <div className="flex gap-1.5 items-center">
          <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
            <rect y="8" width="3" height="4" rx="0.5" fill="black"/>
            <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="black"/>
            <rect x="9" y="2" width="3" height="10" rx="0.5" fill="black"/>
            <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="black"/>
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <path d="M0.5 7.5C2.5 5.5 5.5 4 8 4C10.5 4 13.5 5.5 15.5 7.5M3.5 10C5 8.5 6.5 8 8 8C9.5 8 11 8.5 12.5 10" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
            <rect x="0.75" y="1.5" width="20" height="9" rx="2" stroke="black" strokeWidth="1.5"/>
            <rect x="2.5" y="3" width="16.5" height="6" rx="1" fill="black"/>
            <rect x="22" y="4" width="2.5" height="4" rx="1" fill="black"/>
          </svg>
        </div>
      </div>

      {/* Orange Top Section - Compact */}
      <div className="flex flex-col items-center pt-6 pb-4 px-6">
        {/* Smaller Paw Logo */}
        <div className="mb-3 w-20 h-20 flex items-center justify-center">
          <svg width="80" height="80" viewBox="0 0 120 120" fill="none">
            {/* Main paw pad */}
            <ellipse cx="60" cy="75" rx="22" ry="26" fill="black"/>
            {/* Heart in center */}
            <path d="M60 70C58 68 54 68 52 70C50 72 50 75 52 77L60 85L68 77C70 75 70 72 68 70C66 68 62 68 60 70Z" fill="#FF8C42"/>
            {/* Top left toe */}
            <ellipse cx="40" cy="45" rx="10" ry="14" transform="rotate(-15 40 45)" fill="black"/>
            {/* Top center-left toe */}
            <ellipse cx="50" cy="35" rx="10" ry="14" transform="rotate(-5 50 35)" fill="black"/>
            {/* Top center-right toe */}
            <ellipse cx="70" cy="35" rx="10" ry="14" transform="rotate(5 70 35)" fill="black"/>
            {/* Top right toe */}
            <ellipse cx="80" cy="45" rx="10" ry="14" transform="rotate(15 80 45)" fill="black"/>
          </svg>
        </div>
        
        <h1 className="text-black text-center text-2xl">Choose Your Role</h1>
      </div>

      {/* White Bottom Section - Compact */}
      <div className="flex-1 bg-white rounded-t-[32px] px-4 py-5 overflow-y-auto">
        <p className="text-center text-gray-600 mb-4 text-xs">
          Join as a seller, veterinarian or service provider
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            <p className="text-red-700 text-center text-xs">{error}</p>
          </div>
        ) : null}

        {/* Role Cards - Compact Grid */}
        <div className="space-y-2.5 mb-6">
          {roles.map((role) => {
            // Derive category from vendorTypes (use first vendor type)
            const category = role.vendorTypes && role.vendorTypes.length > 0 
              ? role.vendorTypes[0] 
              : 'service';
            const color = getCategoryColor(category);
            const bgColorClass = getBackgroundColorClass(color);
            const borderColorClass = getBorderColorClass(color);
            
            // Use features array for display badges, fallback to capabilities
            const displayBadges = role.features && role.features.length > 0 
              ? role.features 
              : role.capabilities;
            
            return (
              <Button
                key={role.id}
                onClick={() => onRoleSelect(role.id)}
                className="w-full bg-white border-2 border-gray-200 rounded-xl p-3.5 hover:border-[#FF8C42] transition-all text-left group active:scale-[0.98]"
              >
                <div className="flex items-start gap-3">
                  {/* Compact Icon */}
                  <div className={`w-10 h-10 ${bgColorClass} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    {getIconSvg(category, color)}
                  </div>

                  {/* Content - Compact */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-gray-900 font-semibold text-sm mb-0.5">{role.name}</h3>
                    <p className="text-[10px] text-gray-500 mb-2 leading-tight line-clamp-2">
                      {role.description}
                    </p>
                    
                    {/* Compact Badges */}
                    {displayBadges && displayBadges.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {displayBadges.slice(0, 2).map((badge, idx) => (
                          <span 
                            key={idx}
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${borderColorClass}`}
                          >
                            {badge}
                          </span>
                        ))}
                        {displayBadges.length > 2 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600">
                            +{displayBadges.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Compact Arrow */}
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#FF8C42] flex-shrink-0 mt-0.5" />
                </div>
              </Button>
            );
          })}
        </div>

        {/* Footer Text - Compact */}
        <p className="text-center text-[10px] text-gray-400 leading-tight px-4">
          Trusted by 15,000+ pet professionals worldwide<br />
          © 2025 WARMPAWZ Inc. All rights reserved
        </p>
      </div>

      {/* Home Indicator */}
      <div className="flex justify-center py-3 bg-white">
        <div className="w-32 h-1 bg-black rounded-full"></div>
      </div>
    </div>
  );
}