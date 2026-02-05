'use client';

/**
 * Pharmacy Management Page
 * Manages medicine inventory
 * Capability: pharmacy, inventory
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
  Pill, 
  Plus, 
  Search, 
  Package,
  AlertTriangle,
  IndianRupee,
  TrendingUp,
  Archive
} from 'lucide-react';

interface Medicine {
  id: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  price: number;
  stock: number;
  images?: string[];
  hsn_code?: string;
  gst_rate?: number;
  created_at: string;
}

export default function PharmacyPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMedicine, setNewMedicine] = useState({
    name: '',
    description: '',
    subcategory: '',
    price: 0,
    stock: 0,
    hsnCode: '',
    gstRate: 12,
  });

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    fetchMedicines(storedVendorId);
  }, [router]);

  const fetchMedicines = async (vId?: string) => {
    const id = vId || vendorId;
    if (!id) return;
    
    setLoading(true);
    try {
      const data = await apiClient.get<{ success: boolean; medicines: Medicine[] }>(`/vendor/${id}/pharmacy/medicines`);
      setMedicines(data.medicines || []);
    } catch (error: any) {
      console.error('Error fetching medicines:', error);
      if (error.message?.includes('403')) {
        toast.error('You do not have access to pharmacy management');
      } else {
        toast.error('Failed to load medicines');
      }
    } finally {
      setLoading(false);
    }
  };

  const addMedicine = async () => {
    if (!vendorId || !newMedicine.name || !newMedicine.price) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      await apiClient.post(`/vendor/${vendorId}/pharmacy/medicines`, newMedicine);
      toast.success('Medicine added successfully');
      setShowAddModal(false);
      setNewMedicine({
        name: '',
        description: '',
        subcategory: '',
        price: 0,
        stock: 0,
        hsnCode: '',
        gstRate: 12,
      });
      fetchMedicines();
    } catch (error: any) {
      console.error('Error adding medicine:', error);
      toast.error(error.message || 'Failed to add medicine');
    }
  };

  const filteredMedicines = medicines.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.subcategory?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: medicines.length,
    lowStock: medicines.filter(m => m.stock > 0 && m.stock < 10).length,
    outOfStock: medicines.filter(m => m.stock === 0).length,
    totalValue: medicines.reduce((sum, m) => sum + (m.price * m.stock), 0),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Pill className="h-8 w-8 text-green-500" />
            Pharmacy Inventory
          </h1>
          <p className="text-muted-foreground">Manage your medicine stock</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Medicine
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Package className="h-10 w-10 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Items</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <AlertTriangle className="h-10 w-10 text-yellow-500" />
            <div>
              <p className="text-sm text-muted-foreground">Low Stock</p>
              <p className="text-2xl font-bold">{stats.lowStock}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Archive className="h-10 w-10 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">Out of Stock</p>
              <p className="text-2xl font-bold">{stats.outOfStock}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <IndianRupee className="h-10 w-10 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Inventory Value</p>
              <p className="text-2xl font-bold">₹{stats.totalValue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search medicines..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Medicines Table */}
      {loading ? (
        <div className="text-center py-12">Loading inventory...</div>
      ) : filteredMedicines.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Pill className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No medicines found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Add your first medicine to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Medicine
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4">Medicine</th>
                  <th className="text-left p-4">Category</th>
                  <th className="text-right p-4">Price</th>
                  <th className="text-right p-4">Stock</th>
                  <th className="text-right p-4">Value</th>
                  <th className="text-center p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredMedicines.map((medicine) => (
                  <tr key={medicine.id} className="border-t">
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{medicine.name}</p>
                        {medicine.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {medicine.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="secondary">{medicine.subcategory || 'General'}</Badge>
                    </td>
                    <td className="p-4 text-right">₹{medicine.price}</td>
                    <td className="p-4 text-right">{medicine.stock}</td>
                    <td className="p-4 text-right">₹{(medicine.price * medicine.stock).toLocaleString()}</td>
                    <td className="p-4 text-center">
                      {medicine.stock === 0 ? (
                        <Badge variant="destructive">Out of Stock</Badge>
                      ) : medicine.stock < 10 ? (
                        <Badge className="bg-yellow-100 text-yellow-800">Low Stock</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">In Stock</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Add Medicine Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Add New Medicine</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Medicine Name *</label>
                <Input
                  value={newMedicine.name}
                  onChange={(e) => setNewMedicine(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Paracetamol 500mg"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={newMedicine.description}
                  onChange={(e) => setNewMedicine(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <Input
                  value={newMedicine.subcategory}
                  onChange={(e) => setNewMedicine(prev => ({ ...prev, subcategory: e.target.value }))}
                  placeholder="e.g., Antibiotics, Vitamins"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Price (₹) *</label>
                  <Input
                    type="number"
                    value={newMedicine.price}
                    onChange={(e) => setNewMedicine(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Stock Quantity</label>
                  <Input
                    type="number"
                    value={newMedicine.stock}
                    onChange={(e) => setNewMedicine(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                    min={0}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={addMedicine} className="flex-1">
                  Add Medicine
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
