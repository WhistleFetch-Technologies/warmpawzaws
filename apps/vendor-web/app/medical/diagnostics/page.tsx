'use client';

/**
 * Diagnostics Management Page
 * Manages diagnostic tests catalog
 * Capability: diagnostics, test_catalog
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  DollarSign,
  TestTube,
  Beaker,
  FileText
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
  created_at: string;
}

export default function DiagnosticsPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTest, setNewTest] = useState({
    testName: '',
    testCode: '',
    category: 'blood',
    description: '',
    price: 0,
    durationMinutes: 30,
    sampleType: 'blood',
    preparationInstructions: '',
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

  const addTest = async () => {
    if (!vendorId || !newTest.testName || !newTest.price) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      await apiClient.post(`/vendor/${vendorId}/diagnostics/tests`, newTest);
      toast.success('Diagnostic test added successfully');
      setShowAddModal(false);
      setNewTest({
        testName: '',
        testCode: '',
        category: 'blood',
        description: '',
        price: 0,
        durationMinutes: 30,
        sampleType: 'blood',
        preparationInstructions: '',
      });
      fetchTests();
    } catch (error: any) {
      console.error('Error adding test:', error);
      toast.error(error.message || 'Failed to add diagnostic test');
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Microscope className="h-8 w-8 text-purple-500" />
            Diagnostic Tests
          </h1>
          <p className="text-muted-foreground">Manage your diagnostic test catalog</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Test
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <TestTube className="h-10 w-10 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Tests</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Beaker className="h-10 w-10 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="text-2xl font-bold">{stats.available}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <FileText className="h-10 w-10 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Categories</p>
              <p className="text-2xl font-bold">{stats.categories}</p>
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
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Test
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTests.map((test) => (
            <Card key={test.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TestTube className="h-5 w-5" />
                      {test.test_name}
                    </CardTitle>
                    {test.test_code && (
                      <p className="text-sm text-muted-foreground">Code: {test.test_code}</p>
                    )}
                  </div>
                  <Badge variant={test.is_available ? 'default' : 'secondary'}>
                    {test.is_available ? 'Available' : 'Unavailable'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant="outline">{test.category}</Badge>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>₹{test.price}</span>
                </div>
                {test.duration_minutes && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{test.duration_minutes} minutes</span>
                  </div>
                )}
                {test.sample_type && (
                  <Badge variant="secondary" className="text-xs">{test.sample_type} sample</Badge>
                )}
                {test.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{test.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Test Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 max-h-[90vh] overflow-auto">
            <CardHeader>
              <CardTitle>Add Diagnostic Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    <option value="blood">Blood Test</option>
                    <option value="urine">Urine Test</option>
                    <option value="stool">Stool Test</option>
                    <option value="imaging">Imaging</option>
                    <option value="biopsy">Biopsy</option>
                    <option value="other">Other</option>
                  </select>
                </div>
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
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={addTest} className="flex-1">
                  Add Test
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
