'use client';

/**
 * Vendor Context - Placeholder for vendor-specific state management
 * This provides vendor information and authentication state to child components
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

interface VendorContextType {
  vendor: any | null;
  vendorId: string | null;
  isLoading: boolean;
  apiUrl?: string;
  refreshVendor: () => Promise<void>;
}

const VendorContext = createContext<VendorContextType | undefined>(undefined);

export function VendorProvider({ children }: { children: React.ReactNode }) {
  const [vendor, setVendor] = useState<any | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load vendor data from localStorage
    const loadVendor = () => {
      if (typeof window !== 'undefined') {
        const vendorData = localStorage.getItem('vendorData');
        const storedVendorId = localStorage.getItem('vendorId');
        
        if (vendorData) {
          try {
            const parsedVendor = JSON.parse(vendorData);
            setVendor(parsedVendor);
            setVendorId(parsedVendor.id || storedVendorId);
          } catch (error) {
            console.error('Failed to parse vendor data:', error);
          }
        } else if (storedVendorId) {
          setVendorId(storedVendorId);
        }
      }
      setIsLoading(false);
    };

    loadVendor();
  }, []);

  const refreshVendor = async () => {
    // Reload vendor data from localStorage or API
    if (typeof window !== 'undefined') {
      const vendorData = localStorage.getItem('vendorData');
      if (vendorData) {
        try {
          const parsedVendor = JSON.parse(vendorData);
          setVendor(parsedVendor);
          setVendorId(parsedVendor.id);
        } catch (error) {
          console.error('Failed to parse vendor data:', error);
        }
      }
    }
  };

  return (
    <VendorContext.Provider value={{ vendor, vendorId, isLoading, refreshVendor }}>
      {children}
    </VendorContext.Provider>
  );
}

export function useVendor() {
  const context = useContext(VendorContext);
  if (context === undefined) {
    // Return a default context instead of throwing to prevent build errors
    return {
      vendor: null,
      vendorId: null,
      isLoading: false,
      apiUrl: process.env.NEXT_PUBLIC_API_URL || '',
      refreshVendor: async () => {},
    };
  }
  return context;
}
