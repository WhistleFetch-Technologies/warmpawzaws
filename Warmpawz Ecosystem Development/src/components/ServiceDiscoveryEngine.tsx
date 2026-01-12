import React, { useState } from 'react';
import { Search, MapPin, Filter, X } from 'lucide-react';

/**
 * 🔍 SERVICE DISCOVERY ENGINE
 * 
 * Phase 7C: Rule 6 - Integrated Services
 * 
 * Features:
 * - Search across all integrated services
 * - Location-based filtering
 * - Availability checking
 */

export function ServiceDiscoveryEngine({ apiUrl = `${import.meta.env.VITE_API_URL}/make-server-3dd53475` }) {
  const [query, setQuery] = useState('');
  const [serviceType, setServiceType] = useState<string>('');
  const [location, setLocation] = useState({ lat: 0, lng: 0 });
  const [radius, setRadius] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/integrated-services/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, serviceType, location: location.lat ? location : null, radius }),
      });
      const data = await response.json();
      setResults(data.data?.services || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search services, vendors, areas..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Filter className="w-5 h-5" />
        </button>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {showFilters && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3>Filters</h3>
            <button onClick={() => setShowFilters(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Service Type</label>
              <select
                value={serviceType}
                onChange={e => setServiceType(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Services</option>
                <option value="ambulance">Ambulance</option>
                <option value="medicine">Pharmacy</option>
                <option value="diagnostics">Diagnostics</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Radius (km)</label>
              <input
                type="number"
                value={radius}
                onChange={e => setRadius(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg"
                min={1}
                max={50}
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {results.map(service => (
          <div key={service.serviceId} className="bg-white border rounded-lg p-4 hover:border-blue-500 cursor-pointer">
            <h3>{service.vendorName}</h3>
            <p className="text-sm text-gray-600">{service.location.address}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
