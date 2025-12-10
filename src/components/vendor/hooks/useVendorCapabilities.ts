import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

export interface VendorCapabilities {
  // Core
  booking: boolean;
  chat: boolean;
  tele: boolean;
  
  // Medical/Clinical
  prescription: boolean;
  medical_records: boolean;
  emergency: boolean;
  
  // Commerce
  catalog: boolean;
  orders: boolean;
  inventory: boolean;
  delivery: boolean;
  
  // Media/Content
  photo_updates: boolean;
  gallery: boolean;
  portfolio: boolean;
  progress_tracking: boolean;
  cctv_access: boolean;
  
  // Location
  gps_tracking: boolean;

  // Admin
  staff_management: boolean;
}

// 🇮🇳 HARDCODED: Default capabilities for Veterinarian role (India deployment)
const HARDCODED_VET_CAPABILITIES: VendorCapabilities = {
  booking: true,
  chat: true,
  tele: true,
  prescription: true,
  medical_records: true,
  emergency: true,
  catalog: true,
  orders: false,
  inventory: false,
  delivery: false,
  photo_updates: true,
  gallery: true,
  portfolio: true,
  progress_tracking: true,
  cctv_access: false,
  gps_tracking: false,
  staff_management: true
};

const DEFAULT_CAPABILITIES: VendorCapabilities = {
  booking: true,
  chat: true,
  tele: false,
  prescription: false,
  medical_records: false,
  emergency: false,
  catalog: true,
  orders: true,
  inventory: false,
  delivery: false,
  photo_updates: false,
  gallery: true,
  portfolio: true,
  progress_tracking: false,
  cctv_access: false,
  gps_tracking: false,
  staff_management: false
};

// 🇮🇳 HARDCODED: Role name mapping (India deployment)
const HARDCODED_ROLE_NAMES: Record<string, string> = {
  'veterinarian': 'Veterinarian',
  'veterinary_clinic': 'Veterinary Clinic',
  'groomer': 'Pet Groomer',
  'trainer': 'Pet Trainer',
  'dog_walker': 'Dog Walker',
  'pet_cafe': 'Pet Cafe',
  'pet_resort': 'Pet Resort',
  'nutritionist': 'Pet Nutritionist',
  'behaviorist': 'Pet Behaviorist',
  'boarding': 'Pet Boarding',
  'sunset_services': 'Pet Memorial Services',
  'insurance': 'Pet Insurance Provider',
  'ambulance': 'Pet Ambulance Service',
  'diagnostics': 'Pet Diagnostics Center',
};

export function useVendorCapabilities(roleId?: string) {
  const [capabilities, setCapabilities] = useState<VendorCapabilities>(DEFAULT_CAPABILITIES);
  const [loading, setLoading] = useState(true); // ✅ FIXED: Set to true while fetching
  const [roleName, setRoleName] = useState<string>('');

  useEffect(() => {
    if (!roleId) {
      console.log('⚠️ [CAPABILITIES] No roleId provided');
      setLoading(false);
      return;
    }

    // ✅ ENABLED: Fetch role config from API (was disabled!)
    const fetchRoleConfig = async () => {
      try {
        console.log('🔌 [CAPABILITIES] Fetching role config for:', roleId);
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log('🔌 [CAPABILITIES] API Response:', data);
          console.log('🔌 [CAPABILITIES] Total roles fetched:', data.roles?.length || 0);
          
          const roles = data.roles || [];
          
          // Log all available role IDs for debugging
          console.log('🔌 [CAPABILITIES] Available role IDs:', roles.map((r: any) => r.id).join(', '));
          
          // If no roles exist, provide a helpful message
          if (roles.length === 0) {
            console.warn('⚠️ [CAPABILITIES] No roles found in database!');
            console.warn('💡 [CAPABILITIES] Go to Admin Dashboard → Role Management → "Seed Initial Roles" to initialize the system');
            toast.error('No roles configured. Please contact admin to initialize role system.');
          }
          
          const currentRole = roles.find((r: any) => 
            r.id === roleId || 
            (r.name && roleId && r.name.toLowerCase() === roleId.toLowerCase())
          );
          
          if (currentRole) {
            console.log('✅ [CAPABILITIES] Found role config:', currentRole);
            
            setRoleName(currentRole.name || currentRole.displayName || '');
            
            // Map string capabilities array to boolean object
            const newCapabilities = { ...DEFAULT_CAPABILITIES };
            
            if (currentRole.capabilities && currentRole.capabilities.length > 0) {
              console.log('🔑 [CAPABILITIES] Role capabilities:', currentRole.capabilities);
              
              // Start with all false for explicit control
              Object.keys(newCapabilities).forEach(key => {
                (newCapabilities as any)[key] = false;
              });
              
              // Enable listed capabilities
              currentRole.capabilities.forEach((cap: string) => {
                if (cap in newCapabilities) {
                  (newCapabilities as any)[cap] = true;
                  console.log(`   ✅ Enabled: ${cap}`);
                }
              });

              // Explicit check for staff management object
              if (currentRole.staffManagement?.enabled) {
                newCapabilities.staff_management = true;
                console.log('   ✅ Enabled: staff_management (from staffManagement.enabled)');
              }
            } else {
              console.warn('⚠️ [CAPABILITIES] No capabilities array in role config, using defaults');
            }
            
            setCapabilities(newCapabilities);
            console.log('✅ [CAPABILITIES] Final capabilities:', newCapabilities);
          } else {
            console.warn('⚠️ [CAPABILITIES] Role not found, falling back to hardcoded defaults');
            
            // Fallback to hardcoded for known roles
            const mappedRoleName = HARDCODED_ROLE_NAMES[roleId] || roleId;
            setRoleName(mappedRoleName);
            
            if (roleId === 'veterinarian' || roleId === 'veterinary_clinic' || roleId.includes('vet')) {
              setCapabilities(HARDCODED_VET_CAPABILITIES);
              console.log('✅ Applied hardcoded Veterinarian capabilities');
            } else {
              setCapabilities(DEFAULT_CAPABILITIES);
              console.log('✅ Applied hardcoded Default capabilities');
            }
          }
        } else {
          console.error('❌ [CAPABILITIES] API error:', response.status);
          throw new Error(`API returned ${response.status}`);
        }
      } catch (error) {
        console.error('❌ [CAPABILITIES] Error fetching role capabilities:', error);
        
        // Fallback to hardcoded on error
        const mappedRoleName = HARDCODED_ROLE_NAMES[roleId] || roleId;
        setRoleName(mappedRoleName);
        
        if (roleId === 'veterinarian' || roleId === 'veterinary_clinic' || roleId.includes('vet')) {
          setCapabilities(HARDCODED_VET_CAPABILITIES);
          console.log('✅ Applied hardcoded Veterinarian capabilities (fallback)');
        } else {
          setCapabilities(DEFAULT_CAPABILITIES);
          console.log('✅ Applied hardcoded Default capabilities (fallback)');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRoleConfig();
  }, [roleId]);

  return { capabilities, loading, roleName };
}