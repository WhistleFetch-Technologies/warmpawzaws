'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface SearchResult {
  id: string;
  type: 'vendor' | 'service';
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  city: string;
  price?: number;
  imageUrl?: string;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || '';

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = [
    { id: '', label: 'All', icon: '🔍' },
    { id: 'vet', label: 'Veterinary', icon: '🏥' },
    { id: 'grooming', label: 'Grooming', icon: '✂️' },
    { id: 'training', label: 'Training', icon: '🎓' },
    { id: 'boarding', label: 'Boarding', icon: '🏨' },
    { id: 'walker', label: 'Walker', icon: '🚶' },
    { id: 'cafe', label: 'Pet Cafe', icon: '☕' },
    { id: 'resort', label: 'Resort', icon: '🏝️' },
    { id: 'pharmacy', label: 'Pharmacy', icon: '💊' },
  ];

  useEffect(() => {
    if (query || category) {
      performSearch();
    }
  }, [category]);

  const performSearch = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (category) params.append('category', category);

      const response = await apiClient.get<any>(`/search/universal?${params.toString()}`);
      
      // Combine vendors and services into results
      const vendors = (response.vendors || []).map((v: any) => ({
        id: v.id,
        type: 'vendor' as const,
        name: v.business_name,
        category: v.category,
        rating: parseFloat(v.avg_rating) || 0,
        reviewCount: v.review_count || 0,
        city: v.city,
        imageUrl: v.profile_image,
      }));

      const services = (response.services || []).map((s: any) => ({
        id: s.id,
        type: 'service' as const,
        name: s.service_name,
        category: s.category,
        rating: 0,
        reviewCount: 0,
        city: s.city,
        price: parseFloat(s.base_price),
        imageUrl: s.image_url,
      }));

      setResults([...vendors, ...services]);
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <a href="/" className="p-2 hover:bg-gray-100 rounded-full">
              <span className="text-2xl">←</span>
            </a>
            <div className="flex-1 relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for services, vendors..."
                className="w-full px-4 py-3 pl-12 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition"
            >
              Search
            </button>
          </form>
        </div>
      </header>

      {/* Category Tabs */}
      <div className="bg-white border-b sticky top-[76px] z-40 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 py-3 flex gap-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition ${
                category === cat.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Searching...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500">{error}</p>
            <button
              onClick={performSearch}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-full"
            >
              Try Again
            </button>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-6xl">🔍</span>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">No results found</h2>
            <p className="text-gray-500 mt-2">Try adjusting your search or category</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((result) => (
              <a
                key={`${result.type}-${result.id}`}
                href={result.type === 'vendor' ? `/vendor/${result.id}` : `/service/${result.id}`}
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition"
              >
                <div className="h-40 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-6xl">
                  {result.category === 'vet' ? '🏥' :
                   result.category === 'grooming' ? '✂️' :
                   result.category === 'training' ? '🎓' :
                   result.category === 'boarding' ? '🏨' :
                   result.category === 'walker' ? '🚶' :
                   result.category === 'cafe' ? '☕' :
                   result.category === 'resort' ? '🏝️' : '🐾'}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{result.name}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <span>📍</span> {result.city}
                      </p>
                    </div>
                    {result.price && (
                      <span className="text-orange-500 font-semibold">₹{result.price}</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500">⭐</span>
                      <span className="font-medium">{result.rating.toFixed(1)}</span>
                      <span className="text-gray-400">({result.reviewCount})</span>
                    </div>
                    <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                      {result.category}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-around py-3">
          {[
            { icon: '🏠', label: 'Home', href: '/' },
            { icon: '🔍', label: 'Search', href: '/search', active: true },
            { icon: '📅', label: 'Bookings', href: '/bookings' },
            { icon: '👤', label: 'Profile', href: '/profile' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center ${item.active ? 'text-orange-500' : 'text-gray-500'}`}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs mt-1">{item.label}</span>
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
