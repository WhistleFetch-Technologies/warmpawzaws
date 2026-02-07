import { Heart, ArrowRight, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface AdoptionNudgeProps {
  onDismiss?: () => void;
  onViewAdoption?: () => void;
}

export function AdoptionNudge({ onDismiss, onViewAdoption }: AdoptionNudgeProps) {
  const [nudges, setNudges] = useState<any[]>([]);
  const [visible, setVisible] = useState(true);

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    trackNudgeShown();
  }, []);

  const trackNudgeShown = async () => {
    try {
      await fetch(`${API_BASE}/adoption/nudge-interaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ action: 'shown' })
      });
    } catch (error) {
      console.error('Failed to track nudge shown:', error);
    }
  };

  const handleClick = async () => {
    try {
      await fetch(`${API_BASE}/adoption/nudge-interaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ action: 'clicked' })
      });
      
      if (onViewAdoption) {
        onViewAdoption();
      }
    } catch (error) {
      console.error('Failed to track nudge click:', error);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (!visible) return null;

  return (
    <Card className="bg-gradient-to-r from-red-50 via-pink-50 to-rose-50 border-red-200 p-4 relative overflow-hidden">
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/50 transition-colors"
      >
        <X className="w-4 h-4 text-gray-500" />
      </button>

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
          <Heart className="w-6 h-6 text-white fill-white" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 mb-1">💕 Consider Adoption!</h3>
          <p className="text-sm text-gray-700 mb-3">
            Did you know? Thousands of loving pets are waiting for a home. Adoption saves lives and brings joy!
          </p>
          
          {/* Stats */}
          <div className="flex gap-4 mb-3">
            <div className="text-xs">
              <span className="font-bold text-red-600">500+</span>
              <span className="text-gray-600"> Pets Available</span>
            </div>
            <div className="text-xs">
              <span className="font-bold text-red-600">₹0</span>
              <span className="text-gray-600"> Adoption Fee</span>
            </div>
          </div>

          {/* CTA Button */}
          <Button
            onClick={handleClick}
            size="sm"
            className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white"
          >
            View Adoptable Pets
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Decorative heart pattern */}
      <div className="absolute -bottom-2 -right-2 text-red-200 opacity-20 pointer-events-none">
        <Heart className="w-20 h-20 fill-current" />
      </div>
    </Card>
  );
}
