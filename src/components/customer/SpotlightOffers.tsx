/**
 * Spotlight Offers Component
 * 
 * Reusable component for displaying spotlight/promotional offers on service landing pages.
 * Fetches data from SQL backend endpoint and displays offers with proper styling.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface SpotlightOffer {
  id: string;
  role_id: string;
  service_category?: string | null;
  title: string;
  subtitle?: string | null;
  discount_type: 'percentage' | 'fixed' | 'free';
  discount_value?: number | null;
  badge_text?: string | null;
  icon?: string | null;
  image_url?: string | null;
  cta_text: string;
  cta_link?: string | null;
  metadata?: any | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  display_order: number;
}

interface SpotlightOffersProps {
  roleId: string;
  serviceCategory?: string;
  onNavigate?: (screen: string, data?: any) => void;
  compact?: boolean;
  title?: string;
  className?: string;
}

export function SpotlightOffers({
  roleId,
  serviceCategory,
  onNavigate,
  compact = false,
  title = 'Spotlight Offers',
  className = ''
}: SpotlightOffersProps) {
  const [offers, setOffers] = useState<SpotlightOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSpotlightOffers();
  }, [roleId, serviceCategory]);

  const loadSpotlightOffers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ roleId });
      if (serviceCategory) {
        params.append('serviceCategory', serviceCategory);
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/spotlight-offers?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.offers) {
          setOffers(data.offers);
        }
      }
    } catch (error) {
      console.error('Error loading spotlight offers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOfferClick = (offer: SpotlightOffer) => {
    if (offer.cta_link && onNavigate) {
      // Parse cta_link - could be a screen name or full navigation path
      onNavigate(offer.cta_link);
    }
  };

  const getDiscountText = (offer: SpotlightOffer) => {
    if (offer.discount_type === 'percentage') {
      return `${offer.discount_value}% OFF`;
    } else if (offer.discount_type === 'fixed') {
      return `₹${offer.discount_value} OFF`;
    } else {
      return offer.badge_text || 'Special Offer';
    }
  };

  const getGradientClass = (index: number, metadata?: any) => {
    // Check if metadata has gradient or color config
    if (metadata?.gradient) {
      return metadata.gradient;
    }
    
    // Default gradient rotation based on index
    const gradients = [
      'bg-gradient-to-r from-orange-500 to-pink-500',
      'bg-gradient-to-r from-blue-500 to-indigo-600',
      'bg-gradient-to-r from-green-500 to-teal-600',
      'bg-gradient-to-r from-purple-500 to-pink-500'
    ];
    return gradients[index % gradients.length];
  };

  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  if (offers.length === 0) {
    return null; // Don't render if no offers
  }

  if (compact) {
    // Compact horizontal scroll layout
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
          {offers.map((offer, index) => (
            <Card
              key={offer.id}
              className={`min-w-[280px] flex-shrink-0 bg-white border border-slate-100 p-5 shadow-sm rounded-2xl ${
                offer.image_url ? '' : getGradientClass(index, offer.metadata)
              }`}
              style={offer.image_url ? {
                backgroundImage: `url(${offer.image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : {}}
            >
              {offer.image_url && (
                <div className="absolute inset-0 bg-black/20 rounded-2xl"></div>
              )}
              
              <div className={`relative ${offer.image_url ? 'text-white' : ''}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    {offer.badge_text && (
                      <div className={`${offer.image_url ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'} px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 w-fit backdrop-blur-sm`}>
                        {offer.badge_text}
                      </div>
                    )}
                    <div className={`text-2xl font-bold ${offer.image_url ? 'text-white' : 'text-slate-900'}`}>
                      {getDiscountText(offer)}
                    </div>
                    <div className={`text-sm ${offer.image_url ? 'text-white/90' : 'text-slate-500'}`}>
                      {offer.subtitle || offer.title}
                    </div>
                  </div>
                  {offer.icon && (
                    <div className={`w-10 h-10 ${offer.image_url ? 'bg-white/20' : 'bg-orange-50'} rounded-full flex items-center justify-center backdrop-blur-sm`}>
                      <span className="text-2xl">{offer.icon}</span>
                    </div>
                  )}
                </div>
                
                {offer.title && offer.title !== offer.subtitle && (
                  <div className={`text-lg font-bold mb-2 ${offer.image_url ? 'text-white' : 'text-slate-900'}`}>
                    {offer.title}
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-sm">
                    {offer.end_date && (
                      <span className={`text-xs ${offer.image_url ? 'text-white/80' : 'text-slate-500'}`}>
                        Valid until {new Date(offer.end_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className={`${offer.image_url ? 'bg-white text-slate-900 hover:bg-white/90' : 'bg-orange-600 text-white hover:bg-orange-700'} h-8 text-xs px-4 rounded-lg`}
                    onClick={() => handleOfferClick(offer)}
                  >
                    {offer.cta_text || 'Book Now'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Full-width card layout
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-orange-500" />
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {offers.map((offer, index) => (
          <Card
            key={offer.id}
            className={`relative overflow-hidden bg-white border border-slate-100 rounded-2xl ${
              offer.image_url ? '' : getGradientClass(index, offer.metadata)
            }`}
            style={offer.image_url ? {
              backgroundImage: `url(${offer.image_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              minHeight: '200px'
            } : {}}
          >
            {offer.image_url && (
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent"></div>
            )}
            
            <div className={`relative p-6 ${offer.image_url ? 'text-white' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  {offer.badge_text && (
                    <div className={`${offer.image_url ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'} px-3 py-1 rounded-full text-xs font-bold uppercase mb-3 w-fit backdrop-blur-sm`}>
                      {offer.badge_text}
                    </div>
                  )}
                  <h3 className={`text-2xl font-bold mb-2 ${offer.image_url ? 'text-white' : 'text-slate-900'}`}>
                    {offer.title}
                  </h3>
                  {offer.subtitle && (
                    <p className={`text-base mb-4 ${offer.image_url ? 'text-white/90' : 'text-slate-600'}`}>
                      {offer.subtitle}
                    </p>
                  )}
                  <div className={`text-4xl font-bold mb-4 ${offer.image_url ? 'text-white' : 'text-orange-600'}`}>
                    {getDiscountText(offer)}
                  </div>
                </div>
                {offer.icon && (
                  <div className={`w-16 h-16 ${offer.image_url ? 'bg-white/20' : 'bg-orange-50'} rounded-2xl flex items-center justify-center backdrop-blur-sm ml-4`}>
                    <span className="text-4xl">{offer.icon}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-white/20">
                {offer.end_date && (
                  <div className={`text-sm ${offer.image_url ? 'text-white/80' : 'text-slate-500'}`}>
                    Valid until {new Date(offer.end_date).toLocaleDateString()}
                  </div>
                )}
                <Button
                  size="lg"
                  className={`${offer.image_url ? 'bg-white text-slate-900 hover:bg-white/90' : 'bg-orange-600 text-white hover:bg-orange-700'} px-6`}
                  onClick={() => handleOfferClick(offer)}
                >
                  {offer.cta_text || 'Book Now'}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

