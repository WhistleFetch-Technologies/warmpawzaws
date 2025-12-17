/**
 * PREVIOUS PROVIDERS CAROUSEL
 * Production-Grade Component
 * 
 * Features:
 * - Horizontal scroll of previous service providers
 * - Service selection within provider list
 * - Quick re-booking
 * - Ratings and distance display
 * - Responsive UI
 */

import { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Star, MapPin, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface PreviousProvider {
  vendorId: string;
  vendorName: string;
  staffId?: string;
  staffName?: string;
  roleId: string;
  roleName: string;
  serviceType: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  lastBookingDate: string;
  totalBookings: number;
  rating?: number;
  photo?: string;
  distance?: number;
  services: any[];
  canReBook: boolean;
}

interface PreviousProvidersCarouselProps {
  customerId: string;
  serviceType?: string;
  roleId?: string;
  serviceStyle?: 'at_home' | 'at_center' | 'tele';
  onProviderSelect: (provider: PreviousProvider) => void;
  onServiceSelect?: (provider: PreviousProvider, service: any) => void;
  onQuickBook?: (provider: PreviousProvider) => void;
}

export function PreviousProvidersCarousel({
  customerId,
  serviceType,
  roleId,
  serviceStyle,
  onProviderSelect,
  onServiceSelect,
  onQuickBook
}: PreviousProvidersCarouselProps) {
  const [providers, setProviders] = useState<PreviousProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<PreviousProvider | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadPreviousProviders();
  }, [customerId, serviceType, roleId, serviceStyle]);

  const loadPreviousProviders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (serviceType) params.append('serviceType', serviceType);
      if (roleId) params.append('roleId', roleId);
      if (serviceStyle) params.append('serviceStyle', serviceStyle);

      const response = await fetch(
        `${API_BASE}/customer/${customerId}/previous-providers?${params.toString()}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProviders(data.providers || []);
        }
      }
    } catch (error) {
      console.error('Error loading previous providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="py-4">
        <div className="animate-pulse space-y-3">
          <div className="h-24 bg-gray-200 rounded-lg"></div>
          <div className="h-24 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (providers.length === 0) {
    return null; // Don't show if no previous providers
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-medium text-gray-700">Previously Used Providers</h3>
        {providers.length > 3 && (
          <div className="flex gap-2">
            <button
              onClick={() => scroll('left')}
              className="p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {providers.map((provider) => (
          <Card
            key={`${provider.vendorId}-${provider.staffId || 'none'}`}
            className="min-w-[280px] p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => {
              setSelectedProvider(provider);
              onProviderSelect(provider);
            }}
          >
            <div className="flex items-start gap-3">
              {/* Photo */}
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {provider.photo ? (
                  <img src={provider.photo} alt={provider.vendorName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg">{provider.vendorName.charAt(0)}</span>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {provider.staffName || provider.vendorName}
                </div>
                {provider.staffName && (
                  <div className="text-xs text-gray-500 truncate">{provider.vendorName}</div>
                )}
                
                <div className="flex items-center gap-2 mt-1">
                  {provider.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs text-gray-600">{provider.rating.toFixed(1)}</span>
                    </div>
                  )}
                  {provider.distance && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" />
                      <span>{provider.distance} km</span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500 mt-1">
                  {provider.totalBookings} booking{provider.totalBookings !== 1 ? 's' : ''} • Last: {formatDate(provider.lastBookingDate)}
                </div>

                {/* Services Preview */}
                {provider.services.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {provider.services.slice(0, 2).map((service, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onServiceSelect) {
                            onServiceSelect(provider, service);
                          }
                        }}
                        className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 rounded border border-orange-200 hover:bg-orange-100"
                      >
                        {service.serviceName || service.name}
                      </button>
                    ))}
                    {provider.services.length > 2 && (
                      <span className="text-xs text-gray-500">+{provider.services.length - 2} more</span>
                    )}
                  </div>
                )}

                {/* Quick Book Button */}
                {provider.canReBook && onQuickBook && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickBook(provider);
                    }}
                    className="mt-2 w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white text-xs"
                  >
                    Quick Book
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
