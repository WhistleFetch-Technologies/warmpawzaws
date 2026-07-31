'use client';

import { useState, useEffect, useMemo } from 'react';
import { Percent, Save, Search, ChevronDown, ChevronUp, Trash2, FileText, RefreshCcw, Loader2 } from 'lucide-react';
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

interface PlatformTaxHealth {
  enabled: boolean;
  migrationApplied: boolean;
}

interface PlatformTaxPreview {
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  gstRate: number;
  commissionRate: number | null;
  source: string;
  sourceRowCount: number;
  existingDocumentId: string | null;
  existingInvoiceNumber: string | null;
  missing?: string[];
}

interface PlatformTaxDocumentSummary {
  id: string;
  invoiceNumber: string | null;
  status: string;
  periodFrom: string;
  periodTo: string;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatMoney(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const [platformTaxHealth, setPlatformTaxHealth] = useState<PlatformTaxHealth | null>(null);
  const [platformTaxDocs, setPlatformTaxDocs] = useState<PlatformTaxDocumentSummary[]>([]);
  const [platformTaxLoading, setPlatformTaxLoading] = useState(false);
  const [platformTaxPreview, setPlatformTaxPreview] = useState<PlatformTaxPreview | null>(null);
  const [previewingTaxDoc, setPreviewingTaxDoc] = useState(false);
  const [issuingTaxDoc, setIssuingTaxDoc] = useState(false);
  const monthRange = useMemo(() => currentMonthRange(), []);
  const [taxPeriodFrom, setTaxPeriodFrom] = useState(monthRange.from);
  const [taxPeriodTo, setTaxPeriodTo] = useState(monthRange.to);

  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    if (selectedVendorId) {
      void loadVendorCommission(selectedVendorId);
      void loadPlatformTaxDocuments(selectedVendorId);
      setPlatformTaxPreview(null);
    } else {
      setPlatformTaxDocs([]);
      setPlatformTaxPreview(null);
    }
  }, [selectedVendorId, categories]);

  const loadInitial = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadSellers(),
        loadCategories(),
        loadPlatformCommissionSettings(),
        loadPlatformTaxHealth(),
      ]);
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

  const loadPlatformTaxHealth = async () => {
    try {
      const data = await apiClient.get<any>('/admin/platform-tax/health');
      setPlatformTaxHealth({
        enabled: Boolean((data as any).enabled),
        migrationApplied: Boolean((data as any).migrationApplied),
      });
    } catch {
      setPlatformTaxHealth({ enabled: false, migrationApplied: false });
    }
  };

  const loadPlatformTaxDocuments = async (vendorId: string) => {
    try {
      setPlatformTaxLoading(true);
      const data = await apiClient.get<any>(
        `/vendor/${vendorId}/platform-tax-documents?limit=5`
      );
      const docs = (data as any).documents || (data as any).data?.documents || [];
      setPlatformTaxDocs(Array.isArray(docs) ? docs : []);
    } catch {
      setPlatformTaxDocs([]);
    } finally {
      setPlatformTaxLoading(false);
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
      if (commissionModel === 'ownership') {
        try {
          const ownershipCheck = await apiClient.get<{
            count?: number;
          }>(`/admin/ecommerce/commission/vendors/${selectedVendorId}/products-without-ownership`);
          const missingCount = ownershipCheck?.count ?? 0;
          if (missingCount > 0) {
            toast.warning(
              `${missingCount} active product(s) missing ownership — those lines will use platform default commission until ownership is set on each product.`
            );
          }
        } catch {
          // non-blocking guardrail
        }
      }
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

  const handlePreviewPlatformTax = async () => {
    if (!selectedVendorId) return;
    if (!taxPeriodFrom || !taxPeriodTo) {
      toast.error('Select a billing period');
      return;
    }
    if (taxPeriodTo < taxPeriodFrom) {
      toast.error('Period end must be after period start');
      return;
    }

    try {
      setPreviewingTaxDoc(true);
      const data = await apiClient.post<any>('/admin/platform-tax-documents/preview', {
        vendorId: selectedVendorId,
        periodFrom: taxPeriodFrom,
        periodTo: taxPeriodTo,
      });
      const preview = (data as any).preview || (data as any).data?.preview;
      setPlatformTaxPreview(preview ?? null);
      if (!preview || Number(preview.taxableAmount) <= 0) {
        toast.info('No platform commission found for this period');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to preview tax document');
    } finally {
      setPreviewingTaxDoc(false);
    }
  };

  const handleIssuePlatformTax = async () => {
    if (!selectedVendorId) return;
    if (platformTaxPreview?.existingDocumentId) {
      toast.error('A tax document already exists for this seller and period');
      return;
    }
    if (!platformTaxPreview || platformTaxPreview.taxableAmount <= 0) {
      toast.error('Preview a positive commission amount before issuing');
      return;
    }

    try {
      setIssuingTaxDoc(true);
      const data = await apiClient.post<any>('/admin/platform-tax-documents/issue', {
        vendorId: selectedVendorId,
        periodFrom: taxPeriodFrom,
        periodTo: taxPeriodTo,
      });
      const invoiceNumber = (data as any).invoiceNumber || 'tax document';
      toast.success(`Issued ${invoiceNumber}`);
      setPlatformTaxPreview(null);
      await loadPlatformTaxDocuments(selectedVendorId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to issue tax document');
    } finally {
      setIssuingTaxDoc(false);
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

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#FF8C42]" />
              Platform Tax Documents
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Preview and issue WarmPawz commission tax documents for the selected seller.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={loadPlatformTaxHealth}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Check status
          </Button>
        </div>

        {platformTaxHealth && (!platformTaxHealth.enabled || !platformTaxHealth.migrationApplied) ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Platform tax documents are not ready. Enabled: {platformTaxHealth.enabled ? 'yes' : 'no'},
            migration: {platformTaxHealth.migrationApplied ? 'applied' : 'missing'}.
          </div>
        ) : null}

        {!selectedVendorId ? (
          <div className="mt-4 flex items-center justify-center h-28 text-gray-500 text-sm border border-dashed rounded-lg">
            Select a seller to preview or issue platform tax documents.
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Period from</label>
                <input
                  type="date"
                  value={taxPeriodFrom}
                  onChange={(e) => {
                    setTaxPeriodFrom(e.target.value);
                    setPlatformTaxPreview(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Period to</label>
                <input
                  type="date"
                  value={taxPeriodTo}
                  onChange={(e) => {
                    setTaxPeriodTo(e.target.value);
                    setPlatformTaxPreview(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePreviewPlatformTax}
                disabled={previewingTaxDoc || platformTaxHealth?.enabled === false}
              >
                {previewingTaxDoc ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Preview
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleIssuePlatformTax}
                disabled={
                  issuingTaxDoc ||
                  !platformTaxPreview ||
                  platformTaxPreview.taxableAmount <= 0 ||
                  Boolean(platformTaxPreview.existingDocumentId)
                }
                className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
              >
                {issuingTaxDoc ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Issue
              </Button>
            </div>

            {platformTaxPreview && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Taxable commission</p>
                    <p className="font-semibold text-gray-900">
                      {formatMoney(platformTaxPreview.taxableAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">GST</p>
                    <p className="font-semibold text-gray-900">
                      {formatMoney(platformTaxPreview.gstAmount)} @ {platformTaxPreview.gstRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total</p>
                    <p className="font-semibold text-gray-900">
                      {formatMoney(platformTaxPreview.totalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Source</p>
                    <p className="font-semibold text-gray-900">
                      {platformTaxPreview.source} ({platformTaxPreview.sourceRowCount})
                    </p>
                  </div>
                </div>
                {platformTaxPreview.existingDocumentId && (
                  <p className="mt-3 text-sm text-amber-700">
                    Existing document: {platformTaxPreview.existingInvoiceNumber || platformTaxPreview.existingDocumentId}
                  </p>
                )}
                {platformTaxPreview.missing && platformTaxPreview.missing.length > 0 && (
                  <p className="mt-3 text-xs text-gray-500">
                    Missing source data: {platformTaxPreview.missing.join(', ')}
                  </p>
                )}
              </div>
            )}

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <p className="text-sm font-medium text-gray-700">Recent platform documents</p>
                <button
                  type="button"
                  onClick={() => loadPlatformTaxDocuments(selectedVendorId)}
                  className="text-xs text-[#FF8C42] hover:text-[#E67A32]"
                >
                  Refresh
                </button>
              </div>
              {platformTaxLoading ? (
                <div className="p-4 text-sm text-gray-500">Loading documents...</div>
              ) : platformTaxDocs.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No platform tax documents issued yet.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {platformTaxDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 px-4 py-3 text-sm"
                    >
                      <span className="font-mono text-gray-900">{doc.invoiceNumber || doc.id.slice(0, 8)}</span>
                      <span className="text-gray-600">
                        {doc.periodFrom?.slice(0, 10)} to {doc.periodTo?.slice(0, 10)}
                      </span>
                      <span className="text-gray-900">{formatMoney(doc.totalAmount)}</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 w-fit">
                        {doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
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
