'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Switch,
  Label,
  Input,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@warmpawz/ui';
import {
  Plus,
  Edit2,
  Trash2,
  ReceiptText,
  Search,
  RefreshCw,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';

interface HSNCode {
  id: string;
  code: string;
  description: string;
  category?: string;
  categoryId?: string;
  gstRate: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

type GstApplicationScope = 'service_booking' | 'meal_plan_food' | 'meal_plan_delivery';

function parseGstApplicationScope(raw: unknown): GstApplicationScope {
  const s = String(raw ?? '').trim();
  if (s === 'meal_plan_food') return 'meal_plan_food';
  if (s === 'meal_plan_delivery') return 'meal_plan_delivery';
  return 'service_booking';
}

function isMealPlanGstScope(scope: GstApplicationScope): boolean {
  return scope === 'meal_plan_food' || scope === 'meal_plan_delivery';
}

interface TaxCategory {
  id: string;
  name?: string;
  category_name?: string;
  description: string;
  defaultGSTRate?: number;
  tax_rate?: number;
  applicableServices?: string[];
  /** service_catalog rows whose master category matches GST config */
  linkedCatalogServicesCount?: number;
  catalogCategoryId?: string;
  catalog_category_id?: string;
  catalogCategoryName?: string;
  catalog_category_name?: string;
  gstApplicationScope?: GstApplicationScope;
  gst_application_scope?: GstApplicationScope | string | null;
  role_ids?: string[];
  roles?: { id: string; name: string; display_name: string }[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface CatalogMasterCategory {
  id: string;
  name?: string;
  category_id?: string;
}

function toFiniteTaxRate(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Coalesce rate across DB/API shapes. If `tax_rate` is 0 but legacy `default_gst_rate` is set (positive),
 * use legacy — dev DBs often default `tax_rate` to 0 while the real % lives in `default_gst_rate`.
 */
function parseTaxCategoryGstRate(c: Record<string, unknown>): number {
  const t = toFiniteTaxRate(c.tax_rate);
  const d = toFiniteTaxRate(c.default_gst_rate);
  const g = toFiniteTaxRate(c.gst_rate);
  const dg = toFiniteTaxRate(c.defaultGSTRate);
  if (t !== undefined && t !== 0) return t;
  if (t === 0 && d !== undefined && d > 0) return d;
  if (t === 0 && g !== undefined && g > 0) return g;
  if (t === 0 && dg !== undefined && dg > 0) return dg;
  if (d !== undefined) return d;
  if (g !== undefined) return g;
  if (dg !== undefined) return dg;
  if (t !== undefined) return t;
  return 0;
}

export function GSTConfigurationManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hsnCodes, setHsnCodes] = useState<HSNCode[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'hsn' | 'categories' | 'settings'>(
    'overview'
  );
  const [showHSNModal, setShowHSNModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingHSN, setEditingHSN] = useState<HSNCode | null>(null);
  const [editingCategory, setEditingCategory] = useState<TaxCategory | null>(null);
  const [catalogMasterCategories, setCatalogMasterCategories] = useState<CatalogMasterCategory[]>([]);
  const [catalogRolesOptions, setCatalogRolesOptions] = useState<
    { id: string; name: string; display_name: string }[]
  >([]);
  const [loadingCatalogRoles, setLoadingCatalogRoles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadCatalogMasterCategories = async () => {
    try {
      const data = await apiClient.get<any>('/admin/catalog/categories');
      setCatalogMasterCategories(Array.isArray(data.categories) ? data.categories : []);
    } catch (e) {
      console.error(e);
      setCatalogMasterCategories([]);
    }
  };

  useEffect(() => {
    if (!showCategoryModal) return;
    loadCatalogMasterCategories();
  }, [showCategoryModal]);

  useEffect(() => {
    const cid =
      editingCategory?.catalogCategoryId ?? editingCategory?.catalog_category_id ?? '';
    if (!showCategoryModal || !cid) {
      setCatalogRolesOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingCatalogRoles(true);
    apiClient
      .get<any>(`/admin/finance/gst/catalog-category-roles?catalogCategoryId=${encodeURIComponent(cid)}`)
      .then((d) => {
        if (!cancelled) setCatalogRolesOptions(Array.isArray(d.roles) ? d.roles : []);
      })
      .catch(() => {
        if (!cancelled) setCatalogRolesOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalogRoles(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showCategoryModal, editingCategory?.catalogCategoryId, editingCategory?.catalog_category_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hsnData, categoryData] = await Promise.all([
        apiClient.get<any>('/admin/finance/gst/hsn-codes'),
        apiClient.get<any>('/admin/finance/gst/tax-categories'),
      ]);

      const rawHsn = hsnData.data?.hsnCodes ?? hsnData.hsnCodes ?? hsnData.codes ?? [];
      setHsnCodes(
        Array.isArray(rawHsn)
          ? rawHsn.map((r: any) => ({
              id: r.id,
              code: r.hsn_code ?? r.code,
              description: r.description ?? '',
              category: r.tax_category_name ?? r.category,
              categoryId: (r.category_id ?? r.categoryId) || undefined,
              gstRate: Number(r.effective_gst_rate ?? r.gst_rate ?? r.gstRate ?? 0),
              isActive: r.is_active !== false,
              createdAt: r.created_at,
              updatedAt: r.updated_at,
            }))
          : []
      );
      const rawCat =
        categoryData?.categories ??
        categoryData?.data?.categories ??
        categoryData?.taxCategories ??
        categoryData?.data?.taxCategories ??
        [];
      setTaxCategories(
        Array.isArray(rawCat)
          ? rawCat.map((c: any) => {
              const rate = parseTaxCategoryGstRate(c);
              const gstApplicationScope = parseGstApplicationScope(
                c.gst_application_scope ?? c.gstApplicationScope,
              );
              return {
                id: c.id,
                name: c.name ?? c.category_name,
                category_name: c.category_name ?? c.name,
                description: c.description ?? '',
                defaultGSTRate: rate,
                tax_rate: rate,
                applicableServices: c.applicableServices ?? c.applicable_services ?? [],
                linkedCatalogServicesCount:
                  c.linked_catalog_service_count ?? c.linkedCatalogServicesCount ?? 0,
                catalogCategoryId: c.catalog_category_id ?? c.catalogCategoryId,
                catalogCategoryName: c.catalog_category_name ?? c.catalogCategoryName,
                gstApplicationScope,
                gst_application_scope: gstApplicationScope,
                role_ids: c.role_ids ?? (Array.isArray(c.roles) ? c.roles.map((x: { id: string }) => x.id) : []),
                roles: c.roles ?? [],
                isActive: c.is_active !== false,
                createdAt: c.created_at,
                updatedAt: c.updated_at,
              };
            })
          : []
      );
    } catch (error) {
      console.error('Error loading GST data:', error);
      toast.error('Failed to load GST configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHSN = async () => {
    if (!editingHSN) return;
    setSaving(true);
    try {
      const payload = {
        code: editingHSN.code,
        description: editingHSN.description,
        isActive: editingHSN.isActive,
        categoryId: editingHSN.categoryId || null,
      };
      if (editingHSN.id) {
        await apiClient.put(`/admin/finance/gst/hsn-codes/${editingHSN.id}`, payload);
        toast.success('HSN code updated successfully');
      } else {
        await apiClient.post('/admin/finance/gst/hsn-codes', payload);
        toast.success('HSN code created successfully');
      }
      setShowHSNModal(false);
      setEditingHSN(null);
      loadData();
    } catch (error) {
      const msg =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to save HSN code';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHSN = async (id: string) => {
    if (!confirm('Are you sure you want to delete this HSN code?')) return;
    try {
      await apiClient.delete(`/admin/finance/gst/hsn-codes/${id}`);
      toast.success('HSN code deleted');
      loadData();
    } catch (error) {
      const msg =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to delete HSN code';
      toast.error(msg);
    }
  };

  const handleSaveCategory = async () => {
    if (!editingCategory) return;
    const catalogId =
      editingCategory.catalogCategoryId ?? editingCategory.catalog_category_id ?? '';
    const roleIds = editingCategory.role_ids ?? [];
    const gstScope = parseGstApplicationScope(editingCategory.gstApplicationScope);
    if (!catalogId) {
      toast.error('Select a catalogue category');
      return;
    }
    setSaving(true);
    try {
      const raw = editingCategory.defaultGSTRate;
      const defaultGSTRate =
        typeof raw === 'number' && Number.isFinite(raw)
          ? Math.min(100, Math.max(0, raw))
          : 0;
      const body = {
        catalogCategoryId: catalogId,
        description: editingCategory.description ?? '',
        defaultGSTRate,
        roleIds,
        gstApplicationScope: gstScope,
        isActive: editingCategory.isActive !== false,
      };
      if (editingCategory.id) {
        await apiClient.put(`/admin/finance/gst/tax-categories/${editingCategory.id}`, body);
        toast.success('Tax category updated successfully');
      } else {
        await apiClient.post('/admin/finance/gst/tax-categories', body);
        toast.success('Tax category created successfully');
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      loadData();
    } catch (error) {
      const msg =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to save tax category';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const safeHsnCodes = hsnCodes ?? [];
  const safeTaxCategories = taxCategories ?? [];

  const getCategoryName = (hsn: HSNCode) => {
    if (hsn.categoryId) {
      const cat = safeTaxCategories.find((c) => c.id === hsn.categoryId);
      return cat?.name ?? cat?.category_name ?? hsn.category ?? '—';
    }
    return hsn.category ?? '—';
  };
  const filteredHSN = safeHsnCodes.filter(
    (hsn) =>
      (hsn.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (hsn.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-black text-xl font-semibold">GST Configuration</h2>
            <p className="text-gray-500 text-sm mt-1">Manage GST rates and HSN codes</p>
          </div>
          <PolicyHelpButton docKey="finance-gst-configuration" />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'hsn', label: 'HSN Codes' },
            { id: 'categories', label: 'Tax Categories' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total HSN Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{hsnCodes.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Active HSN Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {hsnCodes.filter((h) => h.isActive).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tax Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{taxCategories.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'hsn' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search HSN codes..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              onClick={() => {
                setEditingHSN({
                  id: '',
                  code: '',
                  description: '',
                  category: '',
                  categoryId: undefined,
                  gstRate: 0,
                  isActive: true,
                });
                setShowHSNModal(true);
              }}
              className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add HSN Code
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>HSN Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>GST % (from tax category)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHSN.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                      <ReceiptText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No HSN codes found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHSN.map((hsn) => (
                    <TableRow key={hsn.id}>
                      <TableCell className="font-medium">{hsn.code}</TableCell>
                      <TableCell>{hsn.description}</TableCell>
                      <TableCell>{getCategoryName(hsn)}</TableCell>
                      <TableCell>{hsn.gstRate}%</TableCell>
                      <TableCell>
                        <Badge variant={hsn.isActive ? 'default' : 'outline'}>
                          {hsn.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingHSN(hsn);
                              setShowHSNModal(true);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteHSN(hsn.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              onClick={() => {
                setEditingCategory({
                  id: '',
                  name: '',
                  description: '',
                  defaultGSTRate: 0,
                  applicableServices: [],
                  catalogCategoryId: '',
                  gstApplicationScope: 'service_booking',
                  role_ids: [],
                  isActive: true,
                });
                setShowCategoryModal(true);
              }}
              className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Tax Category
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {safeTaxCategories.map((category) => (
              <Card key={category.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <CardTitle className="truncate">{category.name}</CardTitle>
                      {(category.gstApplicationScope ?? 'service_booking') === 'meal_plan_food' ? (
                        <Badge variant="secondary" className="shrink-0 text-[11px]">
                          Meal plan food
                        </Badge>
                      ) : (category.gstApplicationScope ?? 'service_booking') === 'meal_plan_delivery' ? (
                        <Badge variant="secondary" className="shrink-0 text-[11px]">
                          Meal plan delivery
                        </Badge>
                      ) : null}
                    </div>
                    <Badge variant={category.isActive ? 'default' : 'outline'} className="shrink-0">
                      {category.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Default GST Rate</span>
                      <span className="font-semibold">
                        {`${parseTaxCategoryGstRate(category as unknown as Partial<Record<string, unknown>>).toFixed(2)}%`}
                      </span>
                    </div>
                    {(category.catalogCategoryName || category.catalog_category_name) && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Catalogue category</span>
                        <span className="font-medium text-right">
                          {category.catalogCategoryName ?? category.catalog_category_name}
                        </span>
                      </div>
                    )}
                    {isMealPlanGstScope(
                      parseGstApplicationScope(category.gstApplicationScope),
                    ) && (category.roles?.length ?? 0) === 0 ? (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium text-gray-700">Applicable roles: </span>
                        Optional — GST uses this catalogue category rate
                      </p>
                    ) : (category.roles?.length ?? 0) > 0 ? (
                      <div className="text-xs text-gray-600">
                        <span className="font-medium text-gray-700">Applicable roles (optional): </span>
                        {(category.roles ?? [])
                          .map((r) => r.display_name || r.name)
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium text-gray-700">Applicable roles: </span>
                        Optional — GST uses this catalogue category rate for every vendor
                      </p>
                    )}
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-sm text-gray-600">
                        Services in catalogue (same master category)
                      </span>
                      <span className="font-semibold shrink-0">
                        {category.linkedCatalogServicesCount ?? 0}
                      </span>
                    </div>
                    {(category.linkedCatalogServicesCount ?? 0) === 0 && (
                      <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-md p-2.5 mt-1 leading-relaxed">
                        No <code className="text-[11px]">service_catalog</code> rows use this master category slug yet.
                        GST at checkout uses <strong>catalogue category + this GST rate</strong>. Vendor role is optional.
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditingCategory({
                          ...category,
                          catalogCategoryId: category.catalogCategoryId ?? category.catalog_category_id,
                          gstApplicationScope: parseGstApplicationScope(category.gstApplicationScope),
                          role_ids: category.role_ids ?? category.roles?.map((r) => r.id) ?? [],
                        });
                        setShowCategoryModal(true);
                      }}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* HSN Code Modal */}
      {showHSNModal && editingHSN && (
        <Dialog open={showHSNModal} onOpenChange={setShowHSNModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingHSN.id ? 'Edit HSN Code' : 'Add HSN Code'}</DialogTitle>
              <DialogDescription>
                HSN/SAC code and linked tax category. GST % is taken from the selected tax category (not stored
                separately on the HSN row for new configs).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>HSN Code</Label>
                <Input
                  value={editingHSN.code}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingHSN({ ...editingHSN, code: e.target.value })}
                  placeholder="e.g., 12345678"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editingHSN.description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingHSN({ ...editingHSN, description: e.target.value })
                  }
                  placeholder="Product/service description"
                />
              </div>
              <div className="space-y-2">
                <Label>Tax Category</Label>
                <select
                  value={editingHSN.categoryId || ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setEditingHSN({
                      ...editingHSN,
                      categoryId: e.target.value || undefined,
                      category: safeTaxCategories.find((c) => c.id === e.target.value)?.name ?? safeTaxCategories.find((c) => c.id === e.target.value)?.category_name ?? '',
                      gstRate: parseTaxCategoryGstRate(
                        (safeTaxCategories.find((c) => c.id === e.target.value) ?? {}) as Partial<
                          Record<string, unknown>
                        >
                      ),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-[#FF8C42] focus:border-[#FF8C42]"
                >
                  <option value="">— Select Tax Category —</option>
                  {safeTaxCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name ?? cat.category_name ?? cat.id}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  GST rate is loaded from this tax category. Required for saving.
                </p>
                {editingHSN.categoryId ? (
                  <p className="text-sm text-gray-700">
                    Effective GST:{' '}
                    <strong>
                      {parseTaxCategoryGstRate(
                        (safeTaxCategories.find((c) => c.id === editingHSN.categoryId) ?? {}) as Partial<
                          Record<string, unknown>
                        >
                      ).toFixed(2)}
                      %
                    </strong>
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={editingHSN.isActive}
                  onCheckedChange={(checked: boolean) =>
                    setEditingHSN({ ...editingHSN, isActive: checked })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowHSNModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveHSN}
                disabled={saving || !editingHSN.categoryId}
                className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Tax Category Modal */}
      {showCategoryModal && editingCategory && (
        <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCategory.id ? 'Edit Tax Category' : 'Add Tax Category'}
              </DialogTitle>
              <DialogDescription>
                Tie GST to a catalogue master category and rate. Applicable roles are optional metadata and do not
                block checkout. Meal plan food and delivery fee use separate scopes on the same catalogue category.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>GST applies to</Label>
                <select
                  value={editingCategory.gstApplicationScope ?? 'service_booking'}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setEditingCategory({
                      ...editingCategory,
                      gstApplicationScope: parseGstApplicationScope(e.target.value),
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-[#FF8C42] focus:border-[#FF8C42]"
                >
                  <option value="service_booking">Service bookings</option>
                  <option value="meal_plan_food">Meal plan food</option>
                  <option value="meal_plan_delivery">Meal plan delivery fee</option>
                </select>
                <p className="text-xs text-gray-500">
                  Meal checkout applies food GST to the meal subtotal and delivery GST to the delivery fee (same
                  catalogue category, different scopes).
                </p>
              </div>
              <div className="space-y-2">
                <Label>Catalogue category</Label>
                <select
                  value={editingCategory.catalogCategoryId ?? editingCategory.catalog_category_id ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const v = e.target.value;
                    setEditingCategory({
                      ...editingCategory,
                      catalogCategoryId: v,
                      catalog_category_id: v,
                      role_ids: [],
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-[#FF8C42] focus:border-[#FF8C42]"
                >
                  <option value="">— Select category —</option>
                  {catalogMasterCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name || cat.category_id || cat.id}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">Loaded fresh from Catalogue each time you open this modal.</p>
              </div>
              <div className="space-y-2">
                <Label>Applicable Roles</Label>
                <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-md p-2">
                  Optional. GST is calculated from the catalogue category and this rate. Roles do not
                  block checkout; leave unchecked to apply the rate to every vendor offering this category.
                </p>
                {loadingCatalogRoles ? (
                  <p className="text-sm text-gray-500">Loading roles for this category…</p>
                ) : !(editingCategory.catalogCategoryId ?? editingCategory.catalog_category_id) ? (
                  <p className="text-sm text-gray-500">Select a catalogue category to load roles.</p>
                ) : catalogRolesOptions.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-md p-2">
                    {isMealPlanGstScope(parseGstApplicationScope(editingCategory.gstApplicationScope))
                      ? 'No roles listed for this category — you can still save a wildcard meal-plan GST row.'
                      : 'No roles match this catalogue category (specialization applicable_roles or vendor Service bucket). Add specs under Catalogue → Categories, set Service on Vendor Roles and Configuration, or pick another category.'}
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                    {catalogRolesOptions.map((r) => {
                      const selected = (editingCategory.role_ids ?? []).includes(r.id);
                      return (
                        <label key={r.id} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              const cur = editingCategory.role_ids ?? [];
                              const next = selected
                                ? cur.filter((x) => x !== r.id)
                                : [...cur, r.id];
                              setEditingCategory({ ...editingCategory, role_ids: next });
                            }}
                            className="rounded border-gray-300"
                          />
                          <span>{r.display_name || r.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editingCategory.description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingCategory({ ...editingCategory, description: e.target.value })
                  }
                  placeholder="Category description"
                />
              </div>
              <div className="space-y-2">
                <Label>Default GST Rate (%)</Label>
                <Input
                  type="number"
                  value={
                    editingCategory.defaultGSTRate != null &&
                    Number.isFinite(editingCategory.defaultGSTRate)
                      ? editingCategory.defaultGSTRate
                      : ''
                  }
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const v = parseFloat(e.target.value);
                    const num = Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
                    setEditingCategory({
                      ...editingCategory,
                      defaultGSTRate: num,
                      tax_rate: num,
                    });
                  }}
                />
                <p className="text-xs text-gray-500">Single source of truth for GST % for this configuration.</p>
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={editingCategory.isActive}
                  onCheckedChange={(checked: boolean) =>
                    setEditingCategory({ ...editingCategory, isActive: checked })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCategoryModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveCategory}
                disabled={
                  saving ||
                  !(editingCategory.catalogCategoryId ?? editingCategory.catalog_category_id)
                }
                className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
