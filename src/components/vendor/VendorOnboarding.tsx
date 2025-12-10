import { useState } from 'react';
import { EnhancedVendorOnboarding } from './onboarding/EnhancedVendorOnboarding';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface VendorOnboardingData {
  services?: string[];
  serviceStyle?: 'clinic' | 'home';
  fullName?: string;
  phone?: string;
  email?: string;
  serviceStyles?: string[];
  roleId?: string;
}

interface VendorOnboardingProps {
  onComplete: (data: VendorOnboardingData) => void;
  phone?: string;
  roleId?: string; // ✅ Pre-selected roleId from VendorRoleSelection
  roleName?: string; // ✅ Role name for display
  onBack?: () => void; // ✅ Back button handler to return to role selection
  initialData?: any; // ✅ NEW: For re-editing applications
}

// ✅ INTEGRATION: Route to EnhancedVendorOnboarding for solo provider support
export function VendorOnboarding(props: VendorOnboardingProps) {
  return <EnhancedVendorOnboarding {...props} />;
}