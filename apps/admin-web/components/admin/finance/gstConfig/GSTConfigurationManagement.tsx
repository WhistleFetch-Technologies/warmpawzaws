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

interface TaxCategory {
  id: string;
  name?: string;
  category_name?: string;
  description: string;
  defaultGSTRate?: number;
  tax_rate?: number;
  applicableServices?: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

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
              categoryId: r.category_id ?? r.categoryId,
              gstRate: r.gst_rate ?? r.gstRate ?? 0,
              isActive: r.is_active !== false,
              createdAt: r.created_at,
              updatedAt: r.updated_at,
            }))
          : []
      );
      const rawCat = categoryData.data?.categories ?? categoryData.data?.taxCategories ?? categoryData.categories ?? categoryData.taxCategories ?? [];
      setTaxCategories(
        Array.isArray(rawCat)
          ? rawCat.map((c: any) => ({
              id: c.id,
              name: c.name ?? c.category_name,
              category_name: c.category_name ?? c.name,
              description: c.description ?? '',
              defaultGSTRate: c.tax_rate ?? c.defaultGSTRate ?? 0,
              tax_rate: c.tax_rate ?? c.defaultGSTRate,
              applicableServices: c.applicableServices ?? c.applicable_services ?? [],
              isActive: c.is_active !== false,
              createdAt: c.created_at,
              updatedAt: c.updated_at,
            }))
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
        gstRate: editingHSN.gstRate,
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
      toast.error('Failed to save HSN code');
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
      toast.error('Failed to delete HSN code');
    }
  };

  const handleSaveCategory = async () => {
    if (!editingCategory) return;
    setSaving(true);
    try {
      if (editingCategory.id) {
        await apiClient.put(
          `/admin/finance/gst/tax-categories/${editingCategory.id}`,
          editingCategory
        );
        toast.success('Tax category updated successfully');
      } else {
        await apiClient.post('/admin/finance/gst/tax-categories', editingCategory);
        toast.success('Tax category created successfully');
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      loadData();
    } catch (error) {
      toast.error('Failed to save tax category');
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
                  <TableHead>GST Rate</TableHead>
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
                  <div className="flex items-center justify-between">
                    <CardTitle>{category.name}</CardTitle>
                    <Badge variant={category.isActive ? 'default' : 'outline'}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Default GST Rate</span>
                      <span className="font-semibold">{category.defaultGSTRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Applicable Services</span>
                      <span className="font-semibold">{(category.applicableServices ?? []).length}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditingCategory(category);
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
              <DialogDescription>Configure HSN code details and GST rates</DialogDescription>
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingHSN({
                      ...editingHSN,
                      categoryId: e.target.value || undefined,
                      category: safeTaxCategories.find((c) => c.id === e.target.value)?.name ?? safeTaxCategories.find((c) => c.id === e.target.value)?.category_name ?? '',
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
                <p className="text-xs text-gray-500">Link to GST Configuration tax category</p>
              </div>
              <div className="space-y-2">
                <Label>GST Rate (%)</Label>
                <Input
                  type="number"
                  value={editingHSN.gstRate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingHSN({ ...editingHSN, gstRate: parseFloat(e.target.value) })
                  }
                />
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
                disabled={saving}
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory.id ? 'Edit Tax Category' : 'Add Tax Category'}
              </DialogTitle>
              <DialogDescription>Configure tax category details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Category Name</Label>
                <Input
                  value={editingCategory.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingCategory({ ...editingCategory, name: e.target.value })
                  }
                  placeholder="e.g., Pet Services"
                />
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
                  value={editingCategory.defaultGSTRate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingCategory({
                      ...editingCategory,
                      defaultGSTRate: parseFloat(e.target.value),
                    })
                  }
                />
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
                disabled={saving}
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
