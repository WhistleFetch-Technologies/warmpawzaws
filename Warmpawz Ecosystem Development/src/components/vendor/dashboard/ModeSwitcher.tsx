import React from 'react';
import { Building2, User, Info } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';

export type VendorMode = 'CENTER' | 'STAFF';

interface ModeSwitcherProps {
  currentMode: VendorMode;
  isSoloProvider: boolean;
  onSwitch: (mode: VendorMode) => void;
  className?: string;
}

export function ModeSwitcher({ 
  currentMode, 
  isSoloProvider, 
  onSwitch,
  className = '' 
}: ModeSwitcherProps) {
  
  // Only show for solo providers
  if (!isSoloProvider) return null;
  
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Mode Toggle */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-2 inline-flex gap-2 shadow-sm">
        <Button
          variant={currentMode === 'CENTER' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onSwitch('CENTER')}
          className={`gap-2 transition-all ${
            currentMode === 'CENTER' 
              ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-md' 
              : 'hover:bg-gray-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span className="hidden sm:inline">Center Profile</span>
          <span className="sm:hidden">Center</span>
        </Button>
        
        <Button
          variant={currentMode === 'STAFF' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onSwitch('STAFF')}
          className={`gap-2 transition-all ${
            currentMode === 'STAFF' 
              ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-md' 
              : 'hover:bg-gray-100'
          }`}
        >
          <User className="w-4 h-4" />
          <span className="hidden sm:inline">Staff Profile</span>
          <span className="sm:hidden">Staff</span>
        </Button>
      </div>
      
      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 max-w-2xl">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          {currentMode === 'CENTER' ? (
            <>
              <strong>Center Mode:</strong> Manage your services, pricing, operating hours, 
              and business settings. Configure what you offer to customers.
            </>
          ) : (
            <>
              <strong>Staff Mode:</strong> View active bookings, enable GPS tracking when 
              traveling to customers, and manage your daily schedule.
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact version for header
export function ModeSwitcherCompact({ 
  currentMode, 
  isSoloProvider, 
  onSwitch 
}: ModeSwitcherProps) {
  
  if (!isSoloProvider) return null;
  
  return (
    <div className="flex items-center gap-3">
      <Badge variant="secondary" className="bg-orange-100 text-orange-800">
        Solo Provider
      </Badge>
      
      <div className="bg-gray-100 rounded-lg p-1 inline-flex gap-1">
        <Button
          variant={currentMode === 'CENTER' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onSwitch('CENTER')}
          className={`h-8 px-3 ${
            currentMode === 'CENTER' 
              ? 'bg-white shadow-sm' 
              : 'hover:bg-gray-200'
          }`}
        >
          <Building2 className="w-4 h-4 mr-1.5" />
          Center
        </Button>
        
        <Button
          variant={currentMode === 'STAFF' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onSwitch('STAFF')}
          className={`h-8 px-3 ${
            currentMode === 'STAFF' 
              ? 'bg-white shadow-sm' 
              : 'hover:bg-gray-200'
          }`}
        >
          <User className="w-4 h-4 mr-1.5" />
          Staff
        </Button>
      </div>
    </div>
  );
}
