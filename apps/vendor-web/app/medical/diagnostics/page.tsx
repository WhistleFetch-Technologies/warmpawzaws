'use client';

/**
 * Diagnostics Management Page
 * Manages diagnostic tests catalog
 * Capability: diagnostics, test_catalog
 * Mobile-first UI (max-w-[430px])
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Microscope, 
  Plus, 
  Search, 
  Clock,
  IndianRupee,
  TestTube,
  Beaker,
  FileText,
  ArrowLeft,
  Truck,
  Edit2,
  Send,
  FileEdit,
  Trash2,
  Building2,
  Home as HomeIcon,
} from 'lucide-react';

interface DiagnosticTest {
  id: string;
  test_name: string;
  test_code?: string;
  category: string;
  description?: string;
  price: number;
  duration_minutes?: number;
  sample_type?: string;
  preparation_instructions?: string;
  is_available: boolean;
  is_free_home_collection?: boolean;
  home_collection_fee?: number;
  service_style?: 'at_center' | 'at_home';
  created_at: string;
}

interface DiagnosticCategory {
  id: string;
  name: string;
}

export default function DiagnosticsPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTest, setEditingTest] = useState<DiagnosticTest | null>(null);
  const [categories, setCategories] = useState<DiagnosticCategory[]>([]);
  const [newTest, setNewTest] = useState({
    testName: '',
    testCode: '',
    category: 'blood',
    otherCategoryName: '',
    description: '',
    price: 0,
    durationMinutes: 30,
    sampleType: 'blood',
    preparationInstructions: '',
    serviceStyle: 'at_center' as 'at_center' | 'at_home',
    isFreeHomeCollection: true,
    homeCollectionFee: 0,
  });

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    fetchTests(storedVendorId);
  }, [router]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' && (window as any).__WARMPAWZ_RUNTIME_CONFIG__?.apiBaseUrl) || '';
        const res = await fetch(`${base}/public/diagnostics/categories`);
        const data = await res.json();
        if (data?.categories?.length) {
          setCategories(data.categories);
        } else {
          setCategories([
            { id: 'blood', name: 'Blood Test' },
            { id: 'urine', name: 'Urine Test' },
            { id: 'stool', name: 'Stool Test' },
            { id: 'imaging', name: 'Imaging' },
            { id: 'biopsy', name: 'Biopsy' },
            { id: 'allergy', name: 'Allergy Tests' },
            { id: 'hormone', name: 'Hormone Tests' },
            { id: 'other', name: 'Other' },
          ]);
        }
      } catch {
        setCategories([
          { id: 'blood', name: 'Blood Test' },
          { id: 'urine', name: 'Urine Test' },
          { id: 'stool', name: 'Stool Test' },
          { id: 'imaging', name: 'Imaging' },
          { id: 'biopsy', name: 'Biopsy' },
          { id: 'other', name: 'Other' },
        ]);
      }
    };
    fetchCategories();
  }, []);

  const fetchTests = async (vId?: string) => {
    const id = vId || vendorId;
    if (!id) return;
    
    setLoading(true);
    try {
      const data = await apiClient.get<{ success: boolean; tests: DiagnosticTest[] }>(`/vendor/${id}/diagnostics/tests`);
      setTests(data.tests || []);
    } catch (error: any) {
      console.error('Error fetching tests:', error);
      if (error.message?.includes('403')) {
        toast.error('You do not have access to diagnostics management');
      } else {
        toast.error('Failed to load diagnostic tests');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingTest(null);
    setNewTest({
      testName: '',
      testCode: '',
      category: 'blood',
      otherCategoryName: '',
      description: '',
      price: 0,
      durationMinutes: 30,
      sampleType: 'blood',
      preparationInstructions: '',
      serviceStyle: 'at_center',
      isFreeHomeCollection: true,
      homeCollectionFee: 0,
    });
  };

  const addTest = async () => {
    if (!vendorId || !newTest.testName || !newTest.price) {
      toast.error('Please fill in required fields');
      return;
    }

    const categoryPayload = newTest.category === 'other' ? 'other' : newTest.category;
    const otherCategoryName = newTest.category === 'other' ? (newTest.otherCategoryName?.trim() || 'Other') : undefined;
    try {
      if (editingTest) {
        await apiClient.put(`/vendor/${vendorId}/diagnostics/tests/${editingTest.id}`, {
          testName: newTest.testName,
          testCode: newTest.testCode || undefined,
          category: categoryPayload,
          otherCategoryName,
          description: newTest.description || undefined,
          price: newTest.price,
          durationMinutes: newTest.durationMinutes,
          sampleType: newTest.sampleType,
          preparationInstructions: newTest.preparationInstructions || undefined,
          serviceStyle: newTest.serviceStyle,
          isFreeHomeCollection: newTest.isFreeHomeCollection,
          homeCollectionFee: newTest.isFreeHomeCollection ? 0 : newTest.homeCollectionFee,
          isAvailable: editingTest.is_available,
        });
        toast.success('Test updated successfully');
      } else {
        await apiClient.post(`/vendor/${vendorId}/diagnostics/tests`, {
          ...newTest,
          category: categoryPayload,
          otherCategoryName,
          serviceStyle: newTest.serviceStyle,
          isFreeHomeCollection: newTest.isFreeHomeCollection,
          homeCollectionFee: newTest.isFreeHomeCollection ? 0 : newTest.homeCollectionFee,
          isAvailable: false, // Draft by default - must publish to go live
        });
        toast.success('Diagnostic test added (saved as Draft)');
      }
      setShowAddModal(false);
      resetForm();
      await fetchTests(); // Ensure list refreshes before closing
    } catch (error: any) {
      console.error('Error saving test:', error);
      toast.error(error.message || 'Failed to save diagnostic test');
    }
  };

  const togglePublish = async (test: DiagnosticTest) => {
    if (!vendorId) return;
    try {
      await apiClient.put(`/vendor/${vendorId}/diagnostics/tests/${test.id}`, {
        isAvailable: !test.is_available,
      });
      toast.success(test.is_available ? 'Test unpublished (Draft)' : 'Test published - now visible to customers');
      await fetchTests();
    } catch (error: any) {
      console.error('Error toggling test status:', error);
      toast.error(error.message || 'Failed to update test status');
    }
  };

  const handleEdit = (test: DiagnosticTest) => {
    setEditingTest(test);
    const cat = test.category || 'blood';
    const isOther = !categories.some(c => c.id === cat && c.name !== 'Other');
    setNewTest({
      testName: test.test_name,
      testCode: test.test_code || '',
      category: isOther ? 'other' : (cat || 'blood'),
      otherCategoryName: isOther ? (test.category || '') : '',
      description: test.description || '',
      price: test.price,
      durationMinutes: test.duration_minutes || 30,
      sampleType: (test.sample_type as any) || 'blood',
      preparationInstructions: test.preparation_instructions || '',
      serviceStyle: ((test as any).service_style === 'at_home' ? 'at_home' : 'at_center') as 'at_center' | 'at_home',
      isFreeHomeCollection: (test as any).is_free_home_collection !== false,
      homeCollectionFee: (test as any).home_collection_fee || 0,
    });
    setShowAddModal(true);
  };

  const handleDelete = async (test: DiagnosticTest) => {
    if (!confirm('Remove this test? It will no longer be visible.')) return;
    if (!vendorId) return;
    try {
      await apiClient.put(`/vendor/${vendorId}/diagnostics/tests/${test.id}`, { isAvailable: false });
      toast.success('Test removed');
      await fetchTests();
    } catch (error: any) {
      console.error('Error removing test:', error);
      toast.error(error.message || 'Failed to remove test');
    }
  };

  const filteredTests = tests.filter(t => 
    t.test_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: tests.length,
    available: tests.filter(t => t.is_available).length,
    categories: [...new Set(tests.map(t => t.category))].length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto min-h-screen p-4 space-y-4">
      {/* Header with Back Arrow */}
      <div className="flex items-center gap-3 p-2 bg-white rounded-xl border-b sticky top-0 z-10 -mx-4 px-4 py-3">
        <Link
          href="/dashboard"
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Microscope className="h-6 w-6 text-purple-500" />
            Diagnostic Tests
          </h1>
          <p className="text-xs text-muted-foreground">Manage your test catalog</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowAddModal(true); }} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Stats - Compact for mobile */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3">
          <CardContent className="p-0 flex items-center gap-2">
            <TestTube className="h-8 w-8 text-purple-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="p-3">
          <CardContent className="p-0 flex items-center gap-2">
            <Beaker className="h-8 w-8 text-green-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Published</p>
              <p className="text-lg font-bold">{stats.available}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="p-3">
          <CardContent className="p-0 flex items-center gap-2">
            <FileText className="h-8 w-8 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Categories</p>
              <p className="text-lg font-bold">{stats.categories}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tests..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tests Grid */}
      {loading ? (
        <div className="text-center py-12">Loading tests...</div>
      ) : filteredTests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Microscope className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No diagnostic tests found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Add your first diagnostic test to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={() => { resetForm(); setShowAddModal(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Test
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTests.map((test) => (
            <Card key={test.id} className="overflow-hidden">
              <CardHeader className="pb-2 px-4 pt-4 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm min-w-0 flex-1">
                    <TestTube className="h-4 w-4 shrink-0 text-purple-500" />
                    <span className="truncate">{test.test_name}</span>
                  </CardTitle>
                  <div className="flex items-center shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(test)} title="Edit">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePublish(test)} title={test.is_available ? 'Unpublish' : 'Publish'}>
                      {test.is_available ? <FileEdit className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(test)} title="Remove">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={test.is_available ? 'default' : 'secondary'} className="text-xs shrink-0">
                    {test.is_available ? 'Published' : 'Draft'}
                  </Badge>
                  {test.test_code && (
                    <span className="text-xs text-muted-foreground">Code: {test.test_code}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4">
                <Badge variant="outline" className="text-xs">{test.category}</Badge>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">₹{test.price}</span>
                  {test.duration_minutes && (
                    <span className="text-muted-foreground">{test.duration_minutes} min</span>
                  )}
                  {(test as any).is_free_home_collection !== undefined && (
                    <span className="flex items-center gap-1 text-xs">
                      <Truck className="h-3 w-3" />
                      {(test as any).is_free_home_collection
                        ? 'Free home collection'
                        : `Home: ₹${(test as any).home_collection_fee || 0}`}
                    </span>
                  )}
                </div>
                {test.sample_type && (
                  <Badge variant="secondary" className="text-xs">{test.sample_type} sample</Badge>
                )}
                {test.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{test.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Test Modal - Mobile-sized */}
      {showAddModal && (
        <div 
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
        >
          <Card className="w-full max-w-[430px] max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                  aria-label="Back to list"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <CardTitle className="text-lg flex-1">
                  {editingTest ? 'Edit Test' : 'Add Diagnostic Test'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              <div>
                <label className="text-sm font-medium">Test Name *</label>
                <Input
                  value={newTest.testName}
                  onChange={(e) => setNewTest(prev => ({ ...prev, testName: e.target.value }))}
                  placeholder="e.g., Complete Blood Count"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Test Code</label>
                  <Input
                    value={newTest.testCode}
                    onChange={(e) => setNewTest(prev => ({ ...prev, testCode: e.target.value }))}
                    placeholder="e.g., CBC001"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={newTest.category}
                    onChange={(e) => setNewTest(prev => ({ ...prev, category: e.target.value }))}
                  >
                    {categories.length ? categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    )) : (
                      <>
                        <option value="blood">Blood Test</option>
                        <option value="urine">Urine Test</option>
                        <option value="stool">Stool Test</option>
                        <option value="imaging">Imaging</option>
                        <option value="biopsy">Biopsy</option>
                        <option value="other">Other</option>
                      </>
                    )}
                  </select>
                  {newTest.category === 'other' && (
                    <Input
                      className="mt-2"
                      placeholder="Enter category name"
                      value={newTest.otherCategoryName}
                      onChange={(e) => setNewTest(prev => ({ ...prev, otherCategoryName: e.target.value }))}
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Where is test conducted?</label>
                <div className="flex gap-3 mt-2">
                  <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    newTest.serviceStyle === 'at_center' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="serviceStyle"
                      checked={newTest.serviceStyle === 'at_center'}
                      onChange={() => setNewTest(prev => ({ ...prev, serviceStyle: 'at_center' }))}
                      className="text-teal-600"
                    />
                    <Building2 className="h-4 w-4" />
                    <span className="text-sm font-medium">At center</span>
                  </label>
                  <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    newTest.serviceStyle === 'at_home' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="serviceStyle"
                      checked={newTest.serviceStyle === 'at_home'}
                      onChange={() => setNewTest(prev => ({ ...prev, serviceStyle: 'at_home' }))}
                      className="text-teal-600"
                    />
                    <HomeIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">At home</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">e.g. X-ray, imaging must be at center; sample collection can be at home.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  className="w-full border rounded-md p-2 min-h-[60px]"
                  value={newTest.description}
                  onChange={(e) => setNewTest(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the test"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Price (₹) *</label>
                  <Input
                    type="number"
                    value={newTest.price}
                    onChange={(e) => setNewTest(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Duration (mins)</label>
                  <Input
                    type="number"
                    value={newTest.durationMinutes}
                    onChange={(e) => setNewTest(prev => ({ ...prev, durationMinutes: parseInt(e.target.value) || 30 }))}
                    min={1}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Sample Type</label>
                <select
                  className="w-full border rounded-md p-2"
                  value={newTest.sampleType}
                  onChange={(e) => setNewTest(prev => ({ ...prev, sampleType: e.target.value }))}
                >
                  <option value="blood">Blood</option>
                  <option value="urine">Urine</option>
                  <option value="stool">Stool</option>
                  <option value="tissue">Tissue</option>
                  <option value="saliva">Saliva</option>
                  <option value="none">None Required</option>
                </select>
              </div>

              {/* Home Sample Collection - Free or Charged */}
              <div className="space-y-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Home Sample Collection
                </label>
                <div className="flex gap-3">
                  <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    newTest.isFreeHomeCollection ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}>
                    <input
                      type="radio"
                      name="homeCollection"
                      checked={newTest.isFreeHomeCollection}
                      onChange={() => setNewTest(prev => ({ ...prev, isFreeHomeCollection: true, homeCollectionFee: 0 }))}
                      className="text-blue-600"
                    />
                    <span className="text-sm font-medium">Free</span>
                  </label>
                  <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    !newTest.isFreeHomeCollection ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}>
                    <input
                      type="radio"
                      name="homeCollection"
                      checked={!newTest.isFreeHomeCollection}
                      onChange={() => setNewTest(prev => ({ ...prev, isFreeHomeCollection: false }))}
                      className="text-blue-600"
                    />
                    <span className="text-sm font-medium">Charged</span>
                  </label>
                </div>
                {!newTest.isFreeHomeCollection && (
                  <div>
                    <label className="text-sm font-medium">Home Collection Fee (₹)</label>
                    <Input
                      type="number"
                      value={newTest.homeCollectionFee}
                      onChange={(e) => setNewTest(prev => ({ ...prev, homeCollectionFee: parseFloat(e.target.value) || 0 }))}
                      min={0}
                      placeholder="e.g., 150"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Preparation Instructions</label>
                <textarea
                  className="w-full border rounded-md p-2 min-h-[60px]"
                  value={newTest.preparationInstructions}
                  onChange={(e) => setNewTest(prev => ({ ...prev, preparationInstructions: e.target.value }))}
                  placeholder="e.g., Fasting required for 12 hours"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setShowAddModal(false); resetForm(); }} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={addTest} className="flex-1">
                  {editingTest ? 'Save Changes' : 'Add Test'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}
