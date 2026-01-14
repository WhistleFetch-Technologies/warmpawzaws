'use client';

/**
 * Simplified Vendor Auth Screen for web
 * Uses the shared VendorAuth component (OTP + session handling)
 */

import React from 'react';
import { VendorAuth } from '@/components/vendor/VendorAuth';

interface VendorAuthScreenProps {
  onAuthSuccess?: (session: any) => void;
}

export function VendorAuthScreen({ onAuthSuccess }: VendorAuthScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
      <VendorAuth onAuthSuccess={onAuthSuccess || (() => {})} />
    </div>
  );
}
