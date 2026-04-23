'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Eye,
  Phone,
  RefreshCw,
  Search,
  X,
  PowerOff,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient, getCustomerWebBaseUrl } from '@/lib/api-client';
import { CustomDropdown } from './CustomDropdown';
import { CustomerDetailsModal } from './CustomerDetailsModal';

interface ActiveCustomerRow {
  id: string;
  name: string;
  businessName: string;
  location: string;
  city: string;
  phone: string;
  email: string;
  completedBookingsCount: number;
}

export function ActiveCustomersTab() {
  const [customers, setCustomers] = useState<ActiveCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [portalLoadingId, setPortalLoadingId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    loadCustomers();
  }, [debouncedSearch, cityFilter]);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '500' });
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (cityFilter !== 'all') params.append('city', cityFilter);

      const data = await apiClient.get<any>(`/admin/customers/active?${params.toString()}`);
      const raw = data?.data ?? data?.body ?? data;
      const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
      const list = parsed.vendors ?? parsed.customers ?? data.vendors ?? data.customers ?? [];

      const mapped: ActiveCustomerRow[] = (list || []).map((v: Record<string, unknown>) => ({
        id: String(v.id),
        name: String(v.businessName || v.ownerName || 'Customer'),
        businessName: String(v.businessName || ''),
        location: String(v.location || v.city || 'N/A'),
        city: String(v.city || ''),
        phone: String(v.phone || ''),
        email: String(v.email || ''),
        completedBookingsCount: Number(v.completedBookingsCount) || 0,
      }));

      setCustomers(mapped);
      setTotalCount(typeof parsed.total === 'number' ? parsed.total : mapped.length);

      const uniq = [...new Set(mapped.map((c) => c.city).filter((c) => c && c.trim()))].sort() as string[];
      setCityOptions((prev) => {
        const s = new Set([...prev, ...uniq]);
        return [...s].sort();
      });
    } catch (error) {
      console.error('[ActiveCustomersTab]', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, cityFilter]);

  const clearFilters = () => {
    setSearchQuery('');
    setCityFilter('all');
  };

  const hasActiveFilters = searchQuery || cityFilter !== 'all';

  const handleOpenCustomerPortal = async (customerId: string) => {
    setPortalLoadingId(customerId);
    try {
      const res = await apiClient.post<{ success?: boolean; code?: string; error?: string }>(
        `/admin/customers/${customerId}/customer-portal-code`,
        {}
      );
      const raw = res as Record<string, unknown>;
      const code = typeof raw?.code === 'string' ? raw.code : null;
      if (!code) {
        const err = typeof raw?.error === 'string' ? raw.error : 'No portal code returned';
        alert(err);
        return;
      }
      const base = getCustomerWebBaseUrl();
      window.open(
        `${base.replace(/\/+$/, '')}/session/from-admin?code=${encodeURIComponent(code)}`,
        '_blank',
        'noopener,noreferrer'
      );
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to open customer app');
    } finally {
      setPortalLoadingId(null);
    }
  };

  const handleDeactivate = async (customerId: string, name: string) => {
    const reason = prompt(`Reason for deactivating ${name}:`);
    if (!reason) return;
    if (!confirm(`Deactivate ${name}?`)) return;
    try {
      await apiClient.post(`/admin/customers/${customerId}/deactivate`, { reason });
      alert('Customer deactivated.');
      loadCustomers();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to deactivate');
    }
  };

  const handleDelete = async (customerId: string, name: string) => {
    const reason = prompt(`Reason for deleting "${name}" (account will be marked inactive):`);
    if (!reason?.trim()) return;
    if (!confirm(`Proceed with delete for "${name}"?`)) return;
    try {
      setDeletingId(customerId);
      await apiClient.post(`/admin/customers/${customerId}/delete`, { reason: reason.trim() });
      alert('Customer removed from active use.');
      loadCustomers();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-6">
        <div className="text-sm text-gray-600 mb-4">Active customer accounts</div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Active customers
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({customers.length}
              {totalCount > customers.length ? ` of ${totalCount}` : ''})
            </span>
          </h3>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <Button variant="outline" className="gap-2 text-gray-600" onClick={clearFilters}>
                <X className="w-4 h-4" />
                Clear
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={loadCustomers} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, phone, email, city…"
            className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {cityOptions.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-4">
            <CustomDropdown
              options={[{ value: 'all', label: 'All cities' }, ...cityOptions.map((c) => ({ value: c, label: c }))]}
              value={cityFilter}
              onChange={setCityFilter}
              placeholder="City"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF8C42]" />
          Loading…
        </div>
      ) : customers.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Eye className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No active customers match your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {customers.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-[#FF8C42]/30 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 text-lg mb-2">{c.name}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Location:</span>
                      <span className="ml-2 text-gray-900 font-medium">{c.location}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Bookings:</span>
                      <span className="ml-2 text-gray-900 font-medium">{c.completedBookingsCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Phone:</span>
                      <span className="ml-2 text-gray-900 font-medium">{c.phone || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2 text-gray-900 font-medium truncate block">{c.email || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-6">
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => setSelectedCustomerId(c.id)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600"
                      onClick={() => c.phone && window.open(`tel:${c.phone}`, '_self')}
                      disabled={!c.phone}
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Call
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-amber-800"
                      onClick={() => handleOpenCustomerPortal(c.id)}
                      disabled={portalLoadingId === c.id}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {portalLoadingId === c.id ? 'Opening…' : 'Open portal'}
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    onClick={() => handleDeactivate(c.id, c.name)}
                  >
                    <PowerOff className="w-4 h-4 mr-2" />
                    Deactivate
                  </Button>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleDelete(c.id, c.name)}
                    disabled={deletingId === c.id}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deletingId === c.id ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCustomerId && (
        <CustomerDetailsModal
          isOpen={!!selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          customerId={selectedCustomerId}
        />
      )}
    </div>
  );
}
