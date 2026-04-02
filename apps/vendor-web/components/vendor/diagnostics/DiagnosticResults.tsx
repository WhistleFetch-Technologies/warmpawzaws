'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { FileText, Upload, Search, Calendar, ArrowLeft, Truck, Edit2, Send, FileEdit, Trash2, ClipboardList, TestTube, Beaker } from 'lucide-react';
import { CapabilityGate } from '../CapabilityGate';
import { UploadResults } from './UploadResults';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { isDiagnosticsCenter } from '@/lib/vendor-utils';

interface DiagnosticTest {
  id: string;
  vendor_id: string;
  test_name: string;
  test_code?: string;
  category?: string;
  description?: string;
  price?: number;
  duration_minutes?: number;
  sample_type?: string;
  preparation_instructions?: string;
  is_available: boolean;
  is_free_home_collection?: boolean;
  home_collection_fee?: number;
}

interface DiagnosticResultsProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
  onNavigateToOrders?: () => void;
}

export function DiagnosticResults({ vendorId, vendorData, onBack, onNavigateToOrders }: DiagnosticResultsProps) {
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [editingTest, setEditingTest] = useState<DiagnosticTest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTests();
  }, [vendorId]);

  const loadTests = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/diagnostics/tests`);
      
      if (response.success) {
        setTests(response.tests || []);
      }
    } catch (error) {
      console.error('Error loading diagnostic tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTests = tests.filter(test => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      test.test_name?.toLowerCase().includes(term) ||
      test.test_code?.toLowerCase().includes(term) ||
      test.category?.toLowerCase().includes(term)
    );
  });

  const togglePublish = async (test: DiagnosticTest) => {
    try {
      await apiClient.put(`/vendor/${vendorId}/diagnostics/tests/${test.id}`, {
        isAvailable: !test.is_available,
      });
      toast.success(test.is_available ? 'Test unpublished (Draft)' : 'Test published - now visible to customers');
      loadTests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (test: DiagnosticTest) => {
    if (!confirm('Remove this test? This cannot be undone.')) return;
    try {
      await apiClient.delete(`/vendor/${vendorId}/diagnostics/tests/${test.id}`);
      toast.success('Test removed');
      loadTests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove');
    }
  };

  if (showUpload || editingTest) {
    return (
      <UploadResults
        vendorId={vendorId}
        editingTest={editingTest}
        onBack={() => {
          setShowUpload(false);
          setEditingTest(null);
        }}
        onSuccess={() => {
          setShowUpload(false);
          setEditingTest(null);
          loadTests();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ✅ Check if vendor is diagnostics center to show Lab Orders link
  const showLabOrdersLink = isDiagnosticsCenter(vendorData) && onNavigateToOrders;

  const stats = {
    total: tests.length,
    published: tests.filter((t) => t.is_available).length,
    categories: [...new Set(tests.map((t) => t.category).filter(Boolean))].length,
  };

  return (
    <CapabilityGate
      requireAny={['diagnostic_results', 'diagnostics', 'test_catalog']}
      allowIfRoleContains="diagnostics,diagnostic,lab"
      showDisabledMessage
      disabledMessage="Diagnostic tests management is not available for your account"
    >
      <div className="space-y-4 w-full max-w-[430px] mx-auto">
        {/* Header with Back Arrow */}
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors shrink-0"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900">Diagnostic Tests</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your test catalog</p>
          </div>
          <button
            onClick={() => { setEditingTest(null); setShowUpload(true); }}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm shrink-0"
          >
            <Upload className="w-4 h-4" />
            Add Test
          </button>
        </div>

        {/* Stats — aligned with /medical/diagnostics catalog summary */}
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
                <p className="text-lg font-bold">{stats.published}</p>
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

        {/* Lab Orders Link - Only for diagnostics centers */}
        {showLabOrdersLink && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
            <button
              onClick={onNavigateToOrders}
              className="w-full flex items-center justify-between text-left hover:bg-teal-100 rounded-md p-2 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="font-semibold text-teal-900">Lab Orders</p>
                  <p className="text-xs text-teal-700">View and manage diagnostic bookings</p>
                </div>
              </div>
              <ArrowLeft className="w-4 h-4 text-teal-600 rotate-180" />
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tests..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tests List */}
        {filteredTests.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No diagnostic tests</h3>
            <p className="text-gray-500 mb-4">Add your first diagnostic test to get started</p>
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Test
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredTests.map((test) => (
              <div
                key={test.id}
                className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition"
              >
                <div className="space-y-2 mb-2">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold text-gray-900 min-w-0 flex-1 truncate">{test.test_name}</h3>
                    <div className="flex items-center shrink-0 gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTest(test)} title="Edit">
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
                    <span className={`px-2 py-0.5 text-xs rounded-full shrink-0 ${test.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {test.is_available ? 'Published' : 'Draft'}
                    </span>
                    {test.test_code && (
                      <span className="text-sm text-gray-500">Code: {test.test_code}</span>
                    )}
                  </div>
                </div>

                {test.category && (
                  <p className="text-sm text-gray-600 mb-2">Category: {test.category}</p>
                )}

                {test.description && (
                  <p className="text-sm text-gray-600 mb-2">{test.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mt-3 pt-3 border-t">
                  {test.price && (
                    <span className="font-medium text-gray-900">₹{test.price}</span>
                  )}
                  {test.duration_minutes && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {test.duration_minutes} min
                    </span>
                  )}
                  {test.sample_type && (
                    <span>Sample: {test.sample_type}</span>
                  )}
                  {test.is_free_home_collection !== undefined && (
                    <span className="flex items-center gap-1">
                      <Truck className="w-4 h-4" />
                      {test.is_free_home_collection ? 'Free home collection' : `Home: ₹${test.home_collection_fee ?? 0}`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CapabilityGate>
  );
}
