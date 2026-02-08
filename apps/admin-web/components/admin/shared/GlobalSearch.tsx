'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface SearchResult {
  id: string;
  type: 'vendor' | 'order' | 'booking' | 'customer' | 'service';
  title: string;
  subtitle?: string;
  href: string;
}

interface GlobalSearchProps {
  className?: string;
}

/**
 * Global search component for admin panel
 * Searches across vendors, orders, bookings, customers, and services
 */
export function GlobalSearch({ className = '' }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
      } else if (event.key === 'Enter' && selectedIndex >= 0) {
        event.preventDefault();
        handleSelectResult(results[selectedIndex]);
      } else if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Search when query changes
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 300); // Debounce

    return () => clearTimeout(timeoutId);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    setIsOpen(true);

    try {
      // Search across multiple endpoints in parallel
      const [vendorsRes, ordersRes, bookingsRes] = await Promise.allSettled([
        apiClient.get<any>(`/admin/vendors?search=${encodeURIComponent(searchQuery)}`),
        apiClient.get<any>(`/admin/orders?search=${encodeURIComponent(searchQuery)}`),
        apiClient.get<any>(`/admin/bookings?search=${encodeURIComponent(searchQuery)}`),
      ]);

      const allResults: SearchResult[] = [];

      // Process vendors
      if (vendorsRes.status === 'fulfilled') {
        const vendors = vendorsRes.value.vendors || vendorsRes.value || [];
        vendors.slice(0, 5).forEach((vendor: any) => {
          allResults.push({
            id: vendor.id,
            type: 'vendor',
            title: vendor.name || vendor.business_name,
            subtitle: vendor.email || vendor.phone,
            href: `/vendors?id=${vendor.id}`,
          });
        });
      }

      // Process orders
      if (ordersRes.status === 'fulfilled') {
        const orders = ordersRes.value.orders || ordersRes.value || [];
        orders.slice(0, 5).forEach((order: any) => {
          allResults.push({
            id: order.id,
            type: 'order',
            title: `Order ${order.order_number || order.id}`,
            subtitle: `₹${order.total_amount || 0} • ${order.order_status}`,
            href: `/orders?id=${order.id}`,
          });
        });
      }

      // Process bookings
      if (bookingsRes.status === 'fulfilled') {
        const bookings = bookingsRes.value.bookings || bookingsRes.value || [];
        bookings.slice(0, 5).forEach((booking: any) => {
          allResults.push({
            id: booking.id,
            type: 'booking',
            title: `Booking ${booking.id.substring(0, 8)}`,
            subtitle: `${booking.booking_date} • ${booking.booking_status}`,
            href: `/bookings?id=${booking.id}`,
          });
        });
      }

      setResults(allResults.slice(0, 10)); // Limit to 10 results
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    router.push(result.href);
    setIsOpen(false);
    setQuery('');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'vendor':
        return '🏪';
      case 'order':
        return '📦';
      case 'booking':
        return '📅';
      case 'customer':
        return '👤';
      case 'service':
        return '🔧';
      default:
        return '📄';
    }
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder="Search vendors, orders, bookings..."
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (query.length >= 2) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleSelectResult(result)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                    index === selectedIndex ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getTypeIcon(result.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {result.title}
                      </div>
                      {result.subtitle && (
                        <div className="text-sm text-gray-500 truncate">
                          {result.subtitle}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 capitalize">
                      {result.type}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
