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
  diagnostic_lab: boolean;
  patient_monitoring: boolean;
  emergency_protocols: boolean;
  ambulance_services: boolean;
  controlled_substances: boolean;
  prescription_verification: boolean;
  vet_summary: boolean;
  
  // Commerce
  catalog: boolean;
  orders: boolean;
  inventory: boolean;
  delivery: boolean;
  expiry_management: boolean;
  
  // Media/Content
  photo_updates: boolean;
  gallery: boolean;
  portfolio: boolean;
  progress_tracking: boolean;
  cctv_access: boolean;
  
  // Location
  gps_tracking: boolean;
  distance_pricing: boolean;

  // Admin & Management
  staff_management: boolean;
  schedule_management: boolean;
  facility_management: boolean;
  multi_doctor_management: boolean;
  
  // Service Management
  custom_services: boolean;
  package_management: boolean;
  
  // Hospitality
  room_management: boolean;
  table_management: boolean;
  pax_management: boolean;
  occupancy_tracking: boolean;
  nightly_pricing: boolean;
  menu: boolean;
  
  // Specialized Services
  meal_plans: boolean;
  diet_charts: boolean;
  counseling: boolean;
  
  // Social & Community
  adoption: boolean;
  donation: boolean;
  events: boolean;
  memorial: boolean;
  
  // Insurance
  claims_management: boolean;
  policy_management: boolean;
}

// 🇮🇳 HARDCODED: Default capabilities for Veterinarian role (India deployment)
const HARDCODED_VET_CAPABILITIES: VendorCapabilities = {
  // Core
  booking: true,
  chat: true,
  tele: true,
  
  // Medical/Clinical
  prescription: true,
  medical_records: true,
  emergency: true,
  diagnostic_lab: true,
  patient_monitoring: true,
  emergency_protocols: true,
  ambulance_services: true,
  controlled_substances: true,
  prescription_verification: true,
  vet_summary: true,
  
  // Commerce
  catalog: true,
  orders: false,
  inventory: false,
  delivery: false,
  expiry_management: false,
  
  // Media/Content
  photo_updates: true,
  gallery: true,
  portfolio: true,
  progress_tracking: true,
  cctv_access: false,
  
  // Location
  gps_tracking: false,
  distance_pricing: false,
  
  // Admin & Management
  staff_management: true,
  schedule_management: true,
  facility_management: true,
  multi_doctor_management: true,
  
  // Service Management
  custom_services: true,
  package_management: true,
  
  // Hospitality
  room_management: false,
  table_management: false,
  pax_management: false,
  occupancy_tracking: false,
  nightly_pricing: false,
  menu: false,
  
  // Specialized Services
  meal_plans: false,
  diet_charts: true,
  counseling: true,
  
  // Social & Community
  adoption: false,
  donation: false,
  events: false,
  memorial: false,
  
  // Insurance
  claims_management: false,
  policy_management: false,
};

const DEFAULT_CAPABILITIES: VendorCapabilities = {
  // Core
  booking: true,
  chat: true,
  tele: false,
  
  // Medical/Clinical
  prescription: false,
  medical_records: false,
  emergency: false,
  diagnostic_lab: false,
  patient_monitoring: false,
  emergency_protocols: false,
  ambulance_services: false,
  controlled_substances: false,
  prescription_verification: false,
  vet_summary: false,
  
  // Commerce
  catalog: true,
  orders: true,
  inventory: false,
  delivery: false,
  expiry_management: false,
  
  // Media/Content
  photo_updates: false,
  gallery: true,
  portfolio: true,
  progress_tracking: false,
  cctv_access: false,
  
  // Location
  gps_tracking: false,
  distance_pricing: false,
  
  // Admin & Management
  staff_management: false,
  schedule_management: true,
  facility_management: false,
  multi_doctor_management: false,
  
  // Service Management
  custom_services: false,
  package_management: false,
  
  // Hospitality
  room_management: false,
  table_management: false,
  pax_management: false,
  occupancy_tracking: false,
  nightly_pricing: false,
  menu: false,
  
  // Specialized Services
  meal_plans: false,
  diet_charts: false,
  counseling: false,
  
  // Social & Community
  adoption: false,
  donation: false,
  events: false,
  memorial: false,
  
  // Insurance
  claims_management: false,
  policy_management: false,
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