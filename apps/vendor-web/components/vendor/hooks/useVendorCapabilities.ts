/**
 * useVendorCapabilities Hook
 * Placeholder hook for vendor capabilities
 */

export interface VendorCapabilities {
  capabilities: any;
  loading: boolean;
  error: any;
}

export function useVendorCapabilities(vendorId: string): VendorCapabilities {
  return {
    capabilities: {},
    loading: false,
    error: null
  };
}
