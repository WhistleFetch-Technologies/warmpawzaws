'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, FlaskConical, Plus, Edit2, Trash2, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

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
  created_at: string;
}

export default function TestCatalogPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTest, setEditingTest] = useState<DiagnosticTest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [formData, setFormData] = useState({
    test_name: '',
    test_code: '',
    category: '',
    description: '',
    price: '',
    duration_minutes: '',
    sample_type: '',
    preparation_instructions: '',
    is_available: true,
  });

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    loadTests(storedVendorId); // Pass id directly - setState is async, vendorId state not yet updated
  }, [router]);

  const loadTests = async (vId?: string) => {
    const id = vId ?? vendorId;
    if (!id) return;
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${id}/diagnostics/tests`);
      setTests(response.tests || []);
    } catch (err: any) {
      console.error('Error loading tests:', err);
      toast.error(err.message || 'Failed to load diagnostic tests');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!vendorId) return;
    try {
      const payload = {
        testName: formData.test_name,
        testCode: formData.test_code || undefined,
        category: formData.category,
        description: formData.description || undefined,
        price: parseFloat(formData.price),
        durationMinutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : undefined,
        sampleType: formData.sample_type || undefined,
        preparationInstructions: formData.preparation_instructions || undefined,
        isAvailable: formData.is_available,
      };

      if (editingTest) {
        await apiClient.put(`/vendor/${vendorId}/diagnostics/tests/${editingTest.id}`, payload);
        toast.success('Test updated successfully');
      } else {
        await apiClient.post(`/vendor/${vendorId}/diagnostics/tests`, payload);
        toast.success('Test added successfully');
      }

      setShowAddForm(false);
      setEditingTest(null);
      resetForm();
      loadTests();
    } catch (err: any) {
      console.error('Error saving test:', err);
      toast.error(err.message || 'Failed to save test');
    }
  };

  const handleEdit = (test: DiagnosticTest) => {
    setEditingTest(test);
    setFormData({
      test_name: test.test_name,
      test_code: test.test_code || '',
      category: test.category,
      description: test.description || '',
      price: test.price.toString(),
      duration_minutes: test.duration_minutes?.toString() || '',
      sample_type: test.sample_type || '',
      preparation_instructions: test.preparation_instructions || '',
      is_available: test.is_available,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (testId: string) => {
    if (!confirm('Are you sure you want to delete this test?')) return;
    if (!vendorId) return;
    try {
      // Note: DELETE endpoint may need to be added to backend
      await apiClient.put(`/vendor/${vendorId}/diagnostics/tests/${testId}`, { is_available: false });
      toast.success('Test removed successfully');
      loadTests();
    } catch (err: any) {
      console.error('Error deleting test:', err);
      toast.error(err.message || 'Failed to delete test');
    }
  };

  const resetForm = () => {
    setFormData({
      test_name: '',
      test_code: '',
      category: '',
      description: '',
      price: '',
      duration_minutes: '',
      sample_type: '',
      preparation_instructions: '',
      is_available: true,
    });
  };

  const categories = Array.from(new Set(tests.map((t) => t.category))).filter(Boolean);

  const filteredTests = tests.filter((test) => {
    if (filterCategory !== 'all' && test.category !== filterCategory) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        test.test_name.toLowerCase().includes(query) ||
        test.test_code?.toLowerCase().includes(query) ||
        test.description?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 safe-area-top">
        <div className="max-w-[430px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (window.history.length > 1) {
                    router.back();
                  } else {
                    router.push('/');
                  }
                }}
                className="w-11 h-11 min-w-[44px] rounded-xl hover:bg-gray-100"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-gray-800">Test Catalog</h1>
                <p className="text-xs text-gray-500">Manage diagnostic tests</p>
              </div>
            </div>
            <Button
              onClick={() => {
                resetForm();
                setEditingTest(null);
                setShowAddForm(true);
              }}
              className="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white min-h-[44px] text-sm flex-shrink-0"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Test
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[430px] mx-auto px-4 py-4 space-y-4">
        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 min-h-[44px]"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full px-3 py-3 min-h-[44px] border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 bg-white"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* Tests List */}
        {filteredTests.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <FlaskConical className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No tests found</h3>
            <p className="text-gray-500">
              {searchQuery || filterCategory !== 'all'
                ? 'Try adjusting your search criteria'
                : 'Add your first diagnostic test to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredTests.map((test) => (
              <div
                key={test.id}
                className="bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <FlaskConical className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{test.test_name}</h3>
                      {test.test_code && (
                        <p className="text-sm text-gray-500">Code: {test.test_code}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(test)}
                      className="h-8 w-8"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(test.id)}
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Category</span>
                    <span className="text-sm font-medium text-gray-900">{test.category}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Price</span>
                    <span className="text-sm font-semibold text-orange-600">₹{test.price}</span>
                  </div>
                  {test.duration_minutes && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Duration</span>
                      <span className="text-sm text-gray-900">{test.duration_minutes} mins</span>
                    </div>
                  )}
                  {test.sample_type && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Sample Type</span>
                      <span className="text-sm text-gray-900">{test.sample_type}</span>
                    </div>
                  )}
                </div>

                {test.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{test.description}</p>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      test.is_available
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {test.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto safe-area-bottom">
              <h2 className="text-xl font-semibold mb-6">
                {editingTest ? 'Edit Test' : 'Add New Test'}
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="test_name">Test Name *</Label>
                    <Input
                      id="test_name"
                      value={formData.test_name}
                      onChange={(e) => setFormData({ ...formData, test_name: e.target.value })}
                      className="mt-1"
                      placeholder="e.g., Complete Blood Count"
                    />
                  </div>
                  <div>
                    <Label htmlFor="test_code">Test Code</Label>
                    <Input
                      id="test_code"
                      value={formData.test_code}
                      onChange={(e) => setFormData({ ...formData, test_code: e.target.value })}
                      className="mt-1"
                      placeholder="e.g., CBC"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="mt-1"
                      placeholder="e.g., Blood Test, Urine Test"
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Price (₹) *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="mt-1"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                    <Input
                      id="duration_minutes"
                      type="number"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                      className="mt-1"
                      min="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sample_type">Sample Type</Label>
                    <Input
                      id="sample_type"
                      value={formData.sample_type}
                      onChange={(e) => setFormData({ ...formData, sample_type: e.target.value })}
                      className="mt-1"
                      placeholder="e.g., Blood, Urine, Stool"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1"
                    rows={3}
                    placeholder="Test description and details..."
                  />
                </div>
                <div>
                  <Label htmlFor="preparation_instructions">Preparation Instructions</Label>
                  <Textarea
                    id="preparation_instructions"
                    value={formData.preparation_instructions}
                    onChange={(e) => setFormData({ ...formData, preparation_instructions: e.target.value })}
                    className="mt-1"
                    rows={2}
                    placeholder="e.g., Fasting required, No food 12 hours before..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_available"
                    checked={formData.is_available}
                    onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <Label htmlFor="is_available" className="cursor-pointer">
                    Test is available for booking
                  </Label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingTest(null);
                    resetForm();
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!formData.test_name || !formData.category || !formData.price}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {editingTest ? 'Update Test' : 'Add Test'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
