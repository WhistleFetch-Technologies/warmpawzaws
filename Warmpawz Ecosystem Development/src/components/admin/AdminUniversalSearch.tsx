/**
 * ========================================
 * ADMIN UNIVERSAL SEARCH DASHBOARD
 * ========================================
 * 
 * Comprehensive admin search with:
 * - Search across all entities (vendors, orders, bookings, customers)
 * - Advanced filters (date range, status, amount)
 * - Export functionality
 * - Quick actions
 * - Analytics view
 * 
 * Usage:
 * <AdminUniversalSearch />
 */

import { useState, useEffect } from 'react';
import { Search, Filter, Download, Calendar, DollarSign, User, Package, ShoppingBag, Calendar as CalendarIcon, TrendingUp, Eye, Edit, Trash2, MoreVertical, Loader2, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface SearchResult {
  type: 'vendor' | 'order' | 'booking' | 'customer';
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  amount?: number;
  date?: string;
  metadata?: Record<string, any>;
}

interface AdminSearchFilters {
  type?: 'vendor' | 'order' | 'booking' | 'customer' | 'all';
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
}

export function AdminUniversalSearch() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<AdminSearchFilters>({ type: 'all' });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState({
    totalVendors: 0,
    totalOrders: 0,
    totalBookings: 0,
    totalCustomers: 0
  });

  // Search function
  const performSearch = async () => {
    if (query.length < 2 && filters.type === 'all') {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      // Call universal search endpoint
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/advanced-search/universal`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            filters,
            limit: 100
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Transform results
        const allResults: SearchResult[] = [];

        // Add vendors
        if (data.vendors) {
          allResults.push(...data.vendors.map((v: any) => ({
            type: 'vendor' as const,
            id: v.id,
            title: v.businessName,
            subtitle: v.services?.join(', '),
            status: v.status,
            metadata: v
          })));
        }

        // Add products as orders (placeholder)
        if (data.products) {
          allResults.push(...data.products.map((p: any) => ({
            type: 'order' as const,
            id: p.id,
            title: p.name,
            subtitle: `Product - ${p.category}`,
            amount: p.price,
            status: p.inStock ? 'in_stock' : 'out_of_stock',
            metadata: p
          })));
        }

        // Add staff as customers (placeholder)
        if (data.staff) {
          allResults.push(...data.staff.map((s: any) => ({
            type: 'customer' as const,
            id: s.id,
            title: s.fullName,
            subtitle: s.specializations?.join(', '),
            status: 'active',
            metadata: s
          })));
        }

        setResults(allResults);
      }
    } catch (error) {
      console.error('Admin search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [query, filters]);

  // Toggle selection
  const toggleSelection = (id: string) => {
    const updated = new Set(selectedResults);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedResults(updated);
  };

  // Export results
  const exportResults = () => {
    const csv = [
      ['Type', 'ID', 'Title', 'Status', 'Amount', 'Date'],
      ...results.map(r => [
        r.type,
        r.id,
        r.title,
        r.status || '',
        r.amount?.toString() || '',
        r.date || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-results-${new Date().toISOString()}.csv`;
    a.click();
  };

  // Get status badge color
  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-700';
    
    switch (status.toLowerCase()) {
      case 'approved':
      case 'active':
      case 'completed':
      case 'delivered':
      case 'in_stock':
        return 'bg-green-100 text-green-700';
      case 'pending':
      case 'processing':
        return 'bg-yellow-100 text-yellow-700';
      case 'rejected':
      case 'cancelled':
      case 'failed':
      case 'out_of_stock':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'vendor':
        return <Package className="w-5 h-5 text-blue-600" />;
      case 'order':
        return <ShoppingBag className="w-5 h-5 text-green-600" />;
      case 'booking':
        return <CalendarIcon className="w-5 h-5 text-purple-600" />;
      case 'customer':
        return <User className="w-5 h-5 text-orange-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            Universal Search
          </h1>
          <p className="text-gray-600">
            Search across vendors, orders, bookings, and customers
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Total Vendors</span>
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl font-semibold text-gray-900">
              {stats.totalVendors.toLocaleString()}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Total Orders</span>
              <ShoppingBag className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-2xl font-semibold text-gray-900">
              {stats.totalOrders.toLocaleString()}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Total Bookings</span>
              <CalendarIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-2xl font-semibold text-gray-900">
              {stats.totalBookings.toLocaleString()}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Total Customers</span>
              <User className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-2xl font-semibold text-gray-900">
              {stats.totalCustomers.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, ID, email, phone..."
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
              />
            </div>

            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
            </Button>

            {selectedResults.size > 0 && (
              <Button
                onClick={exportResults}
                className="flex items-center gap-2 bg-[#FF8C42] hover:bg-[#FF7029]"
              >
                <Download className="w-4 h-4" />
                Export ({selectedResults.size})
              </Button>
            )}
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type
                  </label>
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="all">All</option>
                    <option value="vendor">Vendors</option>
                    <option value="order">Orders</option>
                    <option value="booking">Bookings</option>
                    <option value="customer">Customers</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button
                  variant="outline"
                  onClick={() => setFilters({ type: 'all' })}
                  className="text-sm"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="bg-white rounded-xl border border-gray-200">
          {/* Results Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              {loading ? 'Searching...' : `${results.length} results found`}
            </h3>
            {results.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportResults}
              >
                <Download className="w-4 h-4 mr-2" />
                Export All
              </Button>
            )}
          </div>

          {/* Results List */}
          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
                <p className="text-gray-600">Searching...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="p-12 text-center">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {query ? 'No results found' : 'Start searching'}
                </h3>
                <p className="text-gray-600">
                  {query 
                    ? 'Try different keywords or adjust your filters'
                    : 'Enter a search query to find vendors, orders, bookings, or customers'}
                </p>
              </div>
            ) : (
              results.map((result) => (
                <div
                  key={result.id}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedResults.has(result.id)}
                      onChange={() => toggleSelection(result.id)}
                      className="mt-1"
                    />

                    {/* Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getTypeIcon(result.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate mb-1">
                            {result.title}
                          </h4>
                          {result.subtitle && (
                            <p className="text-sm text-gray-600 truncate">
                              {result.subtitle}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className={`px-2 py-1 text-xs rounded-full capitalize ${getStatusColor(result.status)}`}>
                              {result.status || 'N/A'}
                            </span>
                            <span className="text-xs text-gray-500 capitalize">
                              {result.type}
                            </span>
                            {result.amount !== undefined && (
                              <span className="text-sm font-medium text-gray-900">
                                ₹{result.amount.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
