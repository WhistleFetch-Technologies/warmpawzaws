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
}

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
  gps_tracking: false
};

export function useVendorCapabilities(roleId?: string) {
  const [capabilities, setCapabilities] = useState<VendorCapabilities>(DEFAULT_CAPABILITIES);
  const [loading, setLoading] = useState(true);
  const [roleName, setRoleName] = useState<string>('');

  useEffect(() => {
    if (!roleId) {
      setLoading(false);
      return;
    }

    const fetchRoleConfig = async () => {
      try {
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
          const roles = data.roles || [];
          const currentRole = roles.find((r: any) => r.id === roleId || r.name.toLowerCase() === roleId.toLowerCase());
          
          if (currentRole) {
            setRoleName(currentRole.name);
            
            // Map string capabilities to boolean object
            const newCapabilities = { ...DEFAULT_CAPABILITIES };
            
            // Reset all to false first if we want strict mode, 
            // but let's keep defaults for common things if the role config is missing capabilities
            if (currentRole.capabilities && currentRole.capabilities.length > 0) {
              // If explicit capabilities exist, start with all false
              Object.keys(newCapabilities).forEach(key => {
                (newCapabilities as any)[key] = false;
              });
              
              // Enable listed capabilities
              currentRole.capabilities.forEach((cap: string) => {
                if (cap in newCapabilities) {
                  (newCapabilities as any)[cap] = true;
                }
              });
            }
            
            setCapabilities(newCapabilities);
          }
        }
      } catch (error) {
        console.error('Error fetching role capabilities:', error);
        // Keep defaults on error
      } finally {
        setLoading(false);
      }
    };

    fetchRoleConfig();
  }, [roleId]);

  return { capabilities, loading, roleName };
}
