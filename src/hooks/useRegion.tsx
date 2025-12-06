// useRegion Hook - React Hook for Multi-Region Support
// Provides region context and utilities to components

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  const [region, setRegionState] = useState<Region>(DEFAULT_INDIA_REGION);
  const [regionId, setRegionId] = useState<string>('india');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeRegions, setActiveRegions] = useState<Region[]>([]);

  // Load region on mount
  useEffect(() => {
    loadRegion();
    loadActiveRegions();
  }, []);

  const loadRegion = async () => {
    setIsLoading(true);
    try {
      const currentRegionId = getCurrentRegionId();
      
      // First, try to initialize India region if it doesn't exist
      if (currentRegionId === 'india') {
        console.log('🌍 Initializing India region...');
        await initializeIndiaRegion();
      }
      
      // Now fetch the region
      const fetchedRegion = await fetchRegion(currentRegionId);
      
      if (fetchedRegion) {
        console.log('✅ Region loaded:', fetchedRegion.regionName);
        setRegionState(fetchedRegion);
        setRegionId(currentRegionId);
      } else {
        // Fallback to default India region
        console.log('⚠️ Region not found, using default India region');
        setRegionState(DEFAULT_INDIA_REGION);
        setRegionId('india');
      }
    } catch (error) {
      console.log('⚠️ Error loading region, using default India region');
      setRegionState(DEFAULT_INDIA_REGION);
      setRegionId('india');
    } finally {
      setIsLoading(false);
    }
  };

  const loadActiveRegions = async () => {
    try {
      const regions = await fetchActiveRegions();
      setActiveRegions(regions);
      if (regions.length > 0) {
        console.log(`✅ Loaded ${regions.length} active region(s)`);
      }
    } catch (error) {
      // Silent fail - will keep empty array
      setActiveRegions([]);
    }
  };

  const setRegion = async (newRegionId: string) => {
    setIsLoading(true);
    try {
      const fetchedRegion = await fetchRegion(newRegionId);
      
      if (fetchedRegion) {
        setRegionState(fetchedRegion);
        setRegionId(newRegionId);
        setCurrentRegionId(newRegionId);
      } else {
        console.error(`Region ${newRegionId} not found`);
      }
    } catch (error) {
      console.error('Error setting region:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshRegion = async () => {
    await loadRegion();
    await loadActiveRegions();
  };

  // Utility functions with current region
  const formatCurrency = (amount: number) => formatCurrencyUtil(amount, region);
  const validatePhone = (phone: string) => validatePhoneUtil(phone, region);
  const formatPhoneDisplay = (phone: string) => formatPhoneDisplayUtil(phone, region);
  const phoneToE164 = (phone: string) => phoneToE164Util(phone, region);
  const formatDate = (date: Date | string) => formatDateUtil(date, region);
  const formatTime = (time: string) => formatTimeUtil(time, region);
  const isServiceEnabled = (serviceId: string) => isServiceEnabledUtil(serviceId, region);
  const getPopularBreeds = (species: 'dogs' | 'cats') => getPopularBreedsUtil(species, region);

  const value: RegionContextType = {
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
  };

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
