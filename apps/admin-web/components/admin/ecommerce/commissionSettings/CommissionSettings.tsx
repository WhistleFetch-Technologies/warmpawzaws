'use client';

import { useState, useEffect, useMemo } from 'react';
import { Percent, Save, Search, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { toast, Toaster } from 'sonner';

type CommissionModel = 'category' | 'ownership';

interface SellerOption {
  id: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
  defaultCommissionRate: number | null;
}

interface CategoryRateRow {
  categoryId: string;
  categoryName: string;
  categoryDefault: number | null;
  rate: string;
}

export function CommissionSettings() {
  const [loading, setLoading] = useState(true);
  const [savingVendor, setSavingVendor] = useState(false);
  const [savingPlatform, setSavingPlatform] = useState(false);

  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [sellerSearch, setSellerSearch] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [loadingVendor, setLoadingVendor] = useState(false);

  const [commissionModel, setCommissionModel] = useState<CommissionModel>('category');
  const [vendorDefaultRate, setVendorDefaultRate] = useState('');
  const [ownBrandRate, setOwnBrandRate] = useState('');
  const [thirdPartyRate, setThirdPartyRate] = useState('');
  const [categoryRows, setCategoryRows] = useState<CategoryRateRow[]>([]);
  const [removedCategoryIds, setRemovedCategoryIds] = useState<string[]>([]);

  const [addCategoryId, setAddCategoryId] = useState('');
  const [addCategoryRate, setAddCategoryRate] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [platformDefaultRate, setPlatformDefaultRate] = useState('');

  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    if (selectedVendorId) {
      void loadVendorCommission(selectedVendorId);
    }
  }, [selectedVendorId, categories]);

  const loadInitial = async () => {
    try {
      setLoading(true);
      await Promise.all([loadSellers(), loadCategories(), loadPlatformCommissionSettings()]);
    } finally {
      setLoading(false);
    }
  };

  const loadSellers = async () => {
    try {
      const data = await apiClient.get<any>('/admin/vendor/list');
      const vendors =
        (data as any).data?.vendors || (data as any).vendors || (data as any).data || [];
      const list = (Array.isArray(vendors) ? vendors : []).map((v: Record<string, unknown>) => ({
        id: String(v.id ?? ''),
        name: String(v.business_name ?? v.name ?? v.vendor_name ?? 'Unnamed seller'),
      }));
      setSellers(list.filter((s) => s.id));
    } catch {
      setSellers([]);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await apiClient.get<any>('/admin/ecommerce/categories');
      const raw = (data as any).categories || (data as any).data?.categories || [];
      setCategories(
        raw.map((c: Record<string, unknown>) => ({
          id: String(c.id ?? ''),
          name: String(c.name ?? ''),
          defaultCommissionRate:
            c.default_commission_rate != null && c.default_commission_rate !== ''
              ? Number(c.default_commission_rate)
              : null,
        }))
      );
    } catch {
      setCategories([]);
    }
  };

  const loadPlatformCommissionSettings = async () => {
    try {
      const data = await apiClient.get<any>('/admin/ecommerce/commission/settings');
      const settings = (data as any).settings || (data as any).data?.settings || {};
      const rate = settings.defaultRate ?? settings.commissionRate;
      setPlatformDefaultRate(rate != null ? String(rate) : '');
    } catch {
      setPlatformDefaultRate('');
    }
  };

  const loadVendorCommission = async (vendorId: string) => {
    try {
      setLoadingVendor(true);
      setRemovedCategoryIds([]);
      setAddCategoryId('');
      setAddCategoryRate('');

      const data = await apiClient.get<any>(`/admin/ecommerce/commission/vendors/${vendorId}`);
      const payload = (data as any).data || data;

      setCommissionModel(payload.commissionModel === 'ownership' ? 'ownership' : 'category');
      setVendorDefaultRate(
        payload.defaultCommissionRate != null ? String(payload.defaultCommissionRate) : ''
      );
      setOwnBrandRate(
        payload.ownBrandCommissionRate != null ? String(payload.ownBrandCommissionRate) : ''
      );
      setThirdPartyRate(
        payload.thirdPartyCommissionRate != null ? String(payload.thirdPartyCommissionRate) : ''
      );
      setShowAdvanced(payload.defaultCommissionRate != null);

      const overrides = new Map<string, { rate: number; name: string }>();
      for (const row of payload.categoryRates || []) {
        overrides.set(String(row.categoryId), {
          rate: Number(row.rate),
          name: String(row.categoryName ?? ''),
        });
      }

      const rows: CategoryRateRow[] = [];
      for (const [categoryId, entry] of overrides) {
        const cat = categories.find((c) => c.id === categoryId);
        rows.push({
          categoryId,
          categoryName: entry.name || cat?.name || 'Category',
          categoryDefault: cat?.defaultCommissionRate ?? null,
          rate: String(entry.rate),
        });
      }
      setCategoryRows(rows);
    } catch {
      toast.error('Failed to load vendor commission');
    } finally {
      setLoadingVendor(false);
    }
  };

  const filteredSellers = useMemo(() => {
    const q = sellerSearch.trim().toLowerCase();
    if (!q) return sellers;
    return sellers.filter((s) => s.name.toLowerCase().includes(q));
  }, [sellers, sellerSearch]);

  const selectedSeller = sellers.find((s) => s.id === selectedVendorId);

  const availableCategories = useMemo(() => {
    const configured = new Set(categoryRows.map((r) => r.categoryId));
    return categories.filter((c) => !configured.has(c.id));
  }, [categories, categoryRows]);

  const handleAddCategoryRate = () => {
    if (!addCategoryId || addCategoryRate.trim() === '') {
      toast.error('Select a category and enter a commission rate');
      return;
    }
    const rate = parseFloat(addCategoryRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast.error('Commission rate must be between 0 and 100');
      return;
    }
    const cat = categories.find((c) => c.id === addCategoryId);
    if (!cat) return;

    setCategoryRows((prev) => [
      ...prev.filter((r) => r.categoryId !== addCategoryId),
      {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryDefault: cat.defaultCommissionRate,
        rate: String(rate),
      },
    ]);
    setRemovedCategoryIds((ids) => ids.filter((id) => id !== addCategoryId));
    setAddCategoryId('');
    setAddCategoryRate('');
  };

  const handleRemoveCategoryRate = (categoryId: string) => {
    setCategoryRows((prev) => prev.filter((r) => r.categoryId !== categoryId));
    setRemovedCategoryIds((ids) => (ids.includes(categoryId) ? ids : [...ids, categoryId]));
  };

  const handleSaveVendor = async () => {
    if (!selectedVendorId) return;

    if (commissionModel === 'ownership') {
      if (ownBrandRate.trim() === '' || thirdPartyRate.trim() === '') {
        toast.error('Own brand and Third party commission rates are required');
        return;
      }
    }

    try {
      setSavingVendor(true);
      const categoryRates = categoryRows
        .filter((row) => row.rate.trim() !== '')
        .map((row) => ({
          categoryId: row.categoryId,
          rate: parseFloat(row.rate),
        }));

      await apiClient.put(`/admin/ecommerce/commission/vendors/${selectedVendorId}`, {
        commissionModel,
        defaultRate: vendorDefaultRate.trim() === '' ? null : parseFloat(vendorDefaultRate),
        ownBrandCommissionRate:
          commissionModel === 'ownership' && ownBrandRate.trim() !== ''
            ? parseFloat(ownBrandRate)
            : null,
        thirdPartyCommissionRate:
          commissionModel === 'ownership' && thirdPartyRate.trim() !== ''
            ? parseFloat(thirdPartyRate)
            : null,
        categoryRates: commissionModel === 'category' ? categoryRates : [],
        removedCategoryIds,
      });
      toast.success(`Commission saved for ${selectedSeller?.name ?? 'vendor'}`);
      await loadVendorCommission(selectedVendorId);
    } catch {
      toast.error('Failed to save vendor commission');
    } finally {
      setSavingVendor(false);
    }
  };

  const handleSavePlatformDefault = async () => {
    const rate = parseFloat(platformDefaultRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast.error('Platform default commission must be between 0 and 100');
      return;
    }

    try {
      setSavingPlatform(true);
      const data = await apiClient.put<any>('/admin/ecommerce/commission/settings', {
        defaultRate: rate,
      });
      const settings = (data as any).settings || (data as any).data?.settings || {};
      const savedRate = settings.defaultRate ?? settings.commissionRate ?? rate;
      setPlatformDefaultRate(String(savedRate));
      toast.success('Platform default commission saved');
    } catch {
      toast.error('Failed to save platform default commission');
    } finally {
      setSavingPlatform(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Toaster position="top-right" richColors />
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" richColors />

      <div>
        <h2 className="text-black text-xl font-semibold flex items-center gap-2">
          <Percent className="w-5 h-5 text-[#FF8C42]" />
          Seller Commission
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          One commission model per seller. Category defaults are set under Categories.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Platform Default Commission</h3>
            <p className="text-sm text-gray-500 mt-1">
              Final fallback for ecommerce orders when seller and category rates do not resolve.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rate %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={platformDefaultRate}
                onChange={(e) => setPlatformDefaultRate(e.target.value)}
                placeholder="e.g. 15"
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSavePlatformDefault}
              disabled={savingPlatform}
            >
              {savingPlatform ? 'Saving...' : 'Save Default'}
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Seller</label>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search sellers..."
                value={sellerSearch}
                onChange={(e) => setSellerSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto">
              {filteredSellers.map((seller) => (
                <button
                  key={seller.id}
                  type="button"
                  onClick={() => setSelectedVendorId(seller.id)}
                  className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 hover:bg-orange-50 ${
                    selectedVendorId === seller.id
                      ? 'bg-orange-50 text-[#FF8C42] font-medium'
                      : 'text-gray-700'
                  }`}
                >
                  {seller.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            {!selectedVendorId ? (
              <div className="flex items-center justify-center h-48 text-gray-500 text-sm border border-dashed rounded-lg">
                Select a seller to configure commission
              </div>
            ) : loadingVendor ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium text-gray-900">{selectedSeller?.name}</p>
                  <Button
                    onClick={handleSaveVendor}
                    disabled={savingVendor}
                    className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {savingVendor ? 'Saving...' : 'Save Commission'}
                  </Button>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Commission Model</p>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={commissionModel === 'category'}
                        onChange={() => setCommissionModel('category')}
                      />
                      Category
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={commissionModel === 'ownership'}
                        onChange={() => setCommissionModel('ownership')}
                      />
                      Ownership
                    </label>
                  </div>
                </div>

                {commissionModel === 'category' && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Set commission % per ecommerce category for this seller.
                    </p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <div className="flex-1 min-w-[160px]">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Category
                        </label>
                        <select
                          value={addCategoryId}
                          onChange={(e) => setAddCategoryId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                          <option value="">Select category</option>
                          {availableCategories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                              {cat.defaultCommissionRate != null
                                ? ` (default ${cat.defaultCommissionRate}%)`
                                : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-28">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Rate %
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={addCategoryRate}
                          onChange={(e) => setAddCategoryRate(e.target.value)}
                          placeholder="e.g. 12"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddCategoryRate}>
                        Add
                      </Button>
                    </div>

                    {categoryRows.length === 0 ? (
                      <p className="text-sm text-gray-500 py-4 border border-dashed rounded-lg text-center">
                        No category rates configured yet
                      </p>
                    ) : (
                      <ul className="border border-gray-200 rounded-lg divide-y">
                        {categoryRows.map((row) => (
                          <li
                            key={row.categoryId}
                            className="flex items-center gap-3 px-4 py-3 text-sm"
                          >
                            <span className="flex-1 font-medium">{row.categoryName}</span>
                            <span className="text-gray-500 text-xs">
                              default{' '}
                              {row.categoryDefault != null ? `${row.categoryDefault}%` : '—'}
                            </span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={row.rate}
                              onChange={(e) =>
                                setCategoryRows((prev) =>
                                  prev.map((r) =>
                                    r.categoryId === row.categoryId
                                      ? { ...r, rate: e.target.value }
                                      : r
                                  )
                                )
                              }
                              className="w-20 px-2 py-1 border rounded text-sm"
                            />
                            <span className="text-gray-500">%</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCategoryRate(row.categoryId)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              aria-label={`Remove ${row.categoryName}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {commissionModel === 'ownership' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Own Brand %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        required
                        value={ownBrandRate}
                        onChange={(e) => setOwnBrandRate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Third Party %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        required
                        value={thirdPartyRate}
                        onChange={(e) => setThirdPartyRate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <p className="sm:col-span-2 text-xs text-gray-500">
                      Vendors on this model declare Own brand or Third party on each product at
                      upload.
                    </p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                  >
                    {showAdvanced ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    Advanced: optional vendor default rate
                  </button>
                  {showAdvanced && (
                    <div className="mt-3 max-w-xs">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Vendor Default Rate (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={vendorDefaultRate}
                        onChange={(e) => setVendorDefaultRate(e.target.value)}
                        placeholder="Fallback before category default"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-stone-50 rounded-xl border border-stone-200 p-4">
        <p className="text-xs text-gray-500">
          Priority: vendor model (category or ownership) → optional vendor default → category
          default → platform default → configuration error. No subscription tier fallback for shop
          orders.
        </p>
      </div>
    </div>
  );
}
