// useRegion Hook - React Hook for Multi-Region Support
// Provides region context and utilities to components

import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import {
  Region,
  getCurrentRegionId,
  setCurrentRegionId,
  fetchRegion,
  fetchActiveRegions,
  formatCurrency as formatCurrencyUtil,
  validatePhone as validatePhoneUtil,
  formatPhoneDisplay as formatPhoneDisplayUtil,
  phoneToE164 as phoneToE164Util,
  formatDate as formatDateUtil,
  formatTime as formatTimeUtil,
  isServiceEnabled as isServiceEnabledUtil,
  getPopularBreeds as getPopularBreedsUtil,
  DEFAULT_INDIA_REGION,
  initializeIndiaRegion,
} from '../utils/region';

interface RegionContextType {
  region: Region;
  regionId: string;
  isLoading: boolean;
  activeRegions: Region[];
  setRegion: (regionId: string) => Promise<void>;
  refreshRegion: () => Promise<void>;
  
  // Utility functions with current region
  formatCurrency: (amount: number) => string;
  validatePhone: (phone: string) => boolean;
  formatPhoneDisplay: (phone: string) => string;
  phoneToE164: (phone: string) => string;
  formatDate: (date: Date | string) => string;
  formatTime: (time: string) => string;
  isServiceEnabled: (serviceId: string) => boolean;
  getPopularBreeds: (species: 'dogs' | 'cats') => string[];
}

const RegionContext = createContext<RegionContextType | undefined>(undefined);

export function RegionProvider({ children }: { children: ReactNode }) {
  // 🇮🇳 Start with hardcoded India region as default
  const [region, setRegionState] = useState<Region>(DEFAULT_INDIA_REGION);
  const [regionId, setRegionId] = useState<string>('india');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeRegions, setActiveRegions] = useState<Region[]>([DEFAULT_INDIA_REGION]);

  // Load region on mount with robust error handling
  useEffect(() => {
    loadRegion();
    loadActiveRegions();
  }, []);

  const loadRegion = async () => {
    setIsLoading(true);
    try {
      const currentRegionId = getCurrentRegionId(); // Will always return 'india'
      
      console.log('🌍 Loading region:', currentRegionId);
      
      // Try to fetch from backend
      const fetchedRegion = await fetchRegion(currentRegionId);
      
      if (fetchedRegion) {
        console.log('✅ Region loaded from backend:', fetchedRegion.regionName);
        setRegionState(fetchedRegion);
        setRegionId(currentRegionId);
      } else {
        // Backend fetch failed - use hardcoded default
        console.log('⚠️ Region not found in backend, using hardcoded India region');
        setRegionState(DEFAULT_INDIA_REGION);
        setRegionId('india');
      }
    } catch (error) {
      // Error during fetch - use hardcoded default
      console.log('⚠️ Error loading region from backend, using hardcoded India region');
      console.error('   Error details:', error);
      setRegionState(DEFAULT_INDIA_REGION);
      setRegionId('india');
    } finally {
      setIsLoading(false);
    }
  };

  const loadActiveRegions = async () => {
    try {
      const regions = await fetchActiveRegions();
      if (regions && regions.length > 0) {
        setActiveRegions(regions);
        console.log(`✅ Loaded ${regions.length} active region(s) from backend`);
      } else {
        // No regions from backend - use hardcoded India
        setActiveRegions([DEFAULT_INDIA_REGION]);
        console.log('⚠️ No regions from backend, using hardcoded India region');
      }
    } catch (error) {
      // Error during fetch - use hardcoded India
      console.log('⚠️ Error loading active regions, using hardcoded India region');
      setActiveRegions([DEFAULT_INDIA_REGION]);
    }
  };

  const setRegion = useCallback(async (newRegionId: string) => {
    // For India deployment, only allow 'india' region
    if (newRegionId !== 'india') {
      console.warn('⚠️ Only India region is supported in this deployment');
      return;
    }
    
    setIsLoading(true);
    try {
      const fetchedRegion = await fetchRegion(newRegionId);
      
      if (fetchedRegion) {
        setRegionState(fetchedRegion);
        setRegionId(newRegionId);
        setCurrentRegionId(newRegionId);
      } else {
        console.error(`Region ${newRegionId} not found, using default`);
        setRegionState(DEFAULT_INDIA_REGION);
      }
    } catch (error) {
      console.error('Error setting region:', error);
      setRegionState(DEFAULT_INDIA_REGION);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshRegion = useCallback(async () => {
    await loadRegion();
    await loadActiveRegions();
  }, []);

  // ✅ FIX: Memoize utility functions to prevent recreation
  const formatCurrency = useCallback((amount: number) => formatCurrencyUtil(amount, region), [region]);
  const validatePhone = useCallback((phone: string) => validatePhoneUtil(phone, region), [region]);
  const formatPhoneDisplay = useCallback((phone: string) => formatPhoneDisplayUtil(phone, region), [region]);
  const phoneToE164 = useCallback((phone: string) => phoneToE164Util(phone, region), [region]);
  const formatDate = useCallback((date: Date | string) => formatDateUtil(date, region), [region]);
  const formatTime = useCallback((time: string) => formatTimeUtil(time, region), [region]);
  const isServiceEnabled = useCallback((serviceId: string) => isServiceEnabledUtil(serviceId, region), [region]);
  const getPopularBreeds = useCallback((species: 'dogs' | 'cats') => getPopularBreedsUtil(species, region), [region]);

  // ✅ FIX: Memoize context value to prevent infinite loops
  const value: RegionContextType = useMemo(() => ({
    region,
    regionId,
    isLoading,
    activeRegions,
    setRegion,
    refreshRegion,
    formatCurrency,
    validatePhone,
    formatPhoneDisplay,
    phoneToE164,
    formatDate,
    formatTime,
    isServiceEnabled,
    getPopularBreeds,
  }), [
    region, 
    regionId, 
    isLoading, 
    activeRegions, 
    setRegion, 
    refreshRegion,
    formatCurrency,
    validatePhone,
    formatPhoneDisplay,
    phoneToE164,
    formatDate,
    formatTime,
    isServiceEnabled,
    getPopularBreeds
  ]);

  return (
    <RegionContext.Provider value={value}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion(): RegionContextType {
  const context = useContext(RegionContext);
  if (context === undefined) {
    throw new Error('useRegion must be used within a RegionProvider');
  }
  return context;
}

// Standalone hook for simple currency formatting (for components not using provider)
export function useCurrency() {
  const { formatCurrency } = useRegion();
  return { formatCurrency };
}

// Standalone hook for phone utilities (for components not using provider)
export function usePhone() {
  const { validatePhone, formatPhoneDisplay, phoneToE164, region } = useRegion();
  return {
    validatePhone,
    formatPhoneDisplay,
    phoneToE164,
    phoneConfig: region.phoneConfig,
  };
}