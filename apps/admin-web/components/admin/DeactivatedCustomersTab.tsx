'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Eye,
  Phone,
  RefreshCw,
  Search,
  X,
  Trash2,
  AlertTriangle,
  Calendar,
  Power,
} from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { CustomDropdown } from './CustomDropdown';
import { CustomerDetailsModal } from './CustomerDetailsModal';

interface DeactivatedCustomer {
  id: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  city: string;
  location: string | null;
  completedBookingsCount: number;
  totalRevenue: number;
  deactivatedAt: string | null;
  deactivatedBy: string | null;
  deactivationReason: string | null;
}

export function DeactivatedCustomersTab() {
  const [customers, setCustomers] = useState<DeactivatedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reactivateId, setReactivateId] = useState<string | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    loadList();
  }, [debouncedSearch, cityFilter]);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '500' });
      if (debouncedSearch) params.append('search', debouncedSearch);

      const raw = await apiClient.get<any>(`/admin/customers/deactivated?${params.toString()}`);
      const data = raw?.data ?? raw?.body ?? raw;
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      const list = parsed.vendors ?? parsed.customers ?? [];

      let rows: DeactivatedCustomer[] = (list || []).map((v: Record<string, unknown>) => ({
        id: String(v.id),
        businessName: String(v.businessName || ''),
        ownerName: String(v.ownerName || ''),
        phone: String(v.phone || ''),
        email: String(v.email || ''),
        city: String(v.city || ''),
        location: (v.location as string) || null,
        completedBookingsCount: Number(v.completedBookingsCount) || 0,
        totalRevenue: Number(v.totalRevenue) || 0,
        deactivatedAt: v.deactivatedAt ? String(v.deactivatedAt) : null,
        deactivatedBy: v.deactivatedBy ? String(v.deactivatedBy) : null,
        deactivationReason: v.deactivationReason ? String(v.deactivationReason) : null,
      }));

      if (cityFilter !== 'all') {
        rows = rows.filter((r) => r.city === cityFilter);
      }

      setCustomers(rows);

      const uniq = [...new Set(rows.map((r) => r.city).filter(Boolean))].sort() as string[];
      setCityOptions((prev) => [...new Set([...prev, ...uniq])].sort());
    } catch (error) {
      console.error('[DeactivatedCustomersTab]', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, cityFilter]);

  const handleDelete = async (c: DeactivatedCustomer) => {
    const label = c.businessName || c.ownerName || 'Customer';
    const reason = prompt(`Reason for deleting "${label}":`);
    if (!reason?.trim()) return;
    if (!confirm(`Permanently remove "${label}" from active use?`)) return;
    try {
      setDeletingId(c.id);
      await apiClient.post(`/admin/customers/${c.id}/delete`, { reason: reason.trim() });
      alert('Done.');
      loadList();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReactivate = async (c: DeactivatedCustomer) => {
    const label = c.businessName || c.ownerName || 'Customer';
    if (!confirm(`Reactivate ${label}?`)) return;
    try {
      setReactivateId(c.id);
      await apiClient.post(`/admin/customers/${c.id}/reactivate`, {});
      alert('Customer reactivated.');
      loadList();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed');
    } finally {
      setReactivateId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCityFilter('all');
  };

  const hasActiveFilters = searchQuery || cityFilter !== 'all';

  return (
    <div className="p-4">
      <div className="mb-6">
        <div className="text-sm text-gray-600 mb-4">Deactivated customer accounts</div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Deactivated customers
            <span className="text-sm font-normal text-gray-500 ml-2">({customers.length})</span>
          </h3>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <Button variant="outline" className="gap-2 text-gray-600" onClick={clearFilters}>
                <X className="w-4 h-4" /> Clear
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={loadList} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, phone, email…"
            className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {cityOptions.length > 0 && (
          <CustomDropdown
            options={[{ value: 'all', label: 'All cities' }, ...cityOptions.map((c) => ({ value: c, label: c }))]}
            value={cityFilter}
            onChange={setCityFilter}
            placeholder="City"
          />
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-400" />
          Loading…
        </div>
      ) : customers.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No deactivated customers found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {customers.map((c) => (
            <div key={c.id} className="bg-white border border-red-200 rounded-xl p-5 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-gray-900 text-lg">{c.businessName || c.ownerName || 'Unknown'}</h4>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                      Deactivated
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm mb-2">
                    <div>
                      <span className="text-gray-500">Location:</span>
                      <span className="ml-2 font-medium">{c.location || c.city || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Bookings:</span>
                      <span className="ml-2 font-medium">{c.completedBookingsCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Revenue:</span>
                      <span className="ml-2 font-medium">₹{c.totalRevenue.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500 mb-2">
                    {c.phone && <span>📞 {c.phone}</span>}
                    {c.email && <span>✉️ {c.email}</span>}
                  </div>
                  <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                    <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      Deactivation
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-gray-700">
                      <div>
                        <span className="text-gray-500">Reason: </span>
                        <span className="font-medium">{c.deactivationReason || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-500">Date: </span>
                        <span className="font-medium">{formatDate(c.deactivatedAt)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">By: </span>
                        <span className="font-medium">{c.deactivatedBy || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 ml-6">
                  <Button size="sm" variant="outline" onClick={() => setSelectedCustomerId(c.id)}>
                    <Eye className="w-4 h-4 mr-2" /> View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600"
                    onClick={() => c.phone && window.open(`tel:${c.phone}`, '_self')}
                    disabled={!c.phone}
                  >
                    <Phone className="w-4 h-4 mr-2" /> Call
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-blue-600"
                    onClick={() => handleReactivate(c)}
                    disabled={reactivateId === c.id}
                  >
                    <Power className="w-4 h-4 mr-2" />
                    {reactivateId === c.id ? '…' : 'Reactivate'}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleDelete(c)}
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
