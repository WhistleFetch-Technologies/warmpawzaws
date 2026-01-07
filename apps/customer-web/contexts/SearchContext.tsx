'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as searchContextLib from '@/lib/search-context';

interface SearchContextType {
  query: string;
  category?: string;
  results?: any[];
  selectedVendorId?: string;
  selectedServiceId?: string;
  setQuery: (query: string) => void;
  setCategory: (category?: string) => void;
  setResults: (results?: any[]) => void;
  setSelectedVendorId: (vendorId?: string) => void;
  setSelectedServiceId: (serviceId?: string) => void;
  saveContext: () => void;
  clearContext: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchContextProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState<string>('');
  const [category, setCategory] = useState<string | undefined>();
  const [results, setResults] = useState<any[] | undefined>();
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>();
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>();

  // Load context from localStorage on mount
  useEffect(() => {
    const saved = searchContextLib.getSearchContext();
    if (saved) {
      setQuery(saved.query || '');
      setCategory(saved.category);
      setResults(saved.results);
      setSelectedVendorId(saved.selectedVendorId);
      setSelectedServiceId(saved.selectedServiceId);
    }
  }, []);

  const saveContext = () => {
    searchContextLib.saveSearchContext({
      query,
      category,
      results,
      selectedVendorId,
      selectedServiceId,
      timestamp: Date.now(),
    });
  };

  const clearContext = () => {
    searchContextLib.clearSearchContext();
    setQuery('');
    setCategory(undefined);
    setResults(undefined);
    setSelectedVendorId(undefined);
    setSelectedServiceId(undefined);
  };

  return (
    <SearchContext.Provider
      value={{
        query,
        category,
        results,
        selectedVendorId,
        selectedServiceId,
        setQuery,
        setCategory,
        setResults,
        setSelectedVendorId,
        setSelectedServiceId,
        saveContext,
        clearContext,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchContext() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearchContext must be used within a SearchContextProvider');
  }
  return context;
}
