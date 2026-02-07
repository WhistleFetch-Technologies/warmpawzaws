"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Pill, ShoppingCart, AlertCircle, Upload, CheckCircle2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { useCart } from '@/context/CartContext';
import { toast } from 'sonner';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';

interface PharmacyStoreProps {
  phone?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface Medicine {
  id: string;
  name: string;
  brand?: string;
  dosage?: string;
  quantity: number;
  price: number;
  prescription_required: boolean;
  in_stock: boolean;
  image?: string;
  description?: string;
}

export function PharmacyStore({ phone, onBack, onNavigate }: PharmacyStoreProps) {
  const [loading, setLoading] = useState(true);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionUploaded, setPrescriptionUploaded] = useState(false);
  const { addToCart, itemCount } = useCart();
  const [stats, setStats] = useState({ totalMedicines: 0, orders: 0, rating: '4.8' });

  const categories = [
    { id: 'all', label: 'All', icon: Pill },
    { id: 'antibiotics', label: 'Antibiotics', icon: Pill },
    { id: 'vaccines', label: 'Vaccines', icon: Pill },
    { id: 'supplements', label: 'Supplements', icon: Pill },
    { id: 'grooming', label: 'Grooming', icon: Pill }
  ];

  useEffect(() => {
    loadMedicines();
  }, []);

  const loadMedicines = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ medicines?: Medicine[]; products?: Medicine[] }>('/customer/pharmacy/medicines');
      const medicineList = data.medicines || data.products || [];
      const filteredMedicines = medicineList.filter(m => m.in_stock !== false);
      setMedicines(filteredMedicines);
      // Update stats
      setStats({
        totalMedicines: filteredMedicines.length,
        orders: 0, // Can be loaded from API if available
        rating: '4.8'
      });
    } catch (error) {
      console.error('Error loading medicines:', error);
      setMedicines([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrescriptionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Prescription file size should be less than 5MB');
      return;
    }

    setPrescriptionFile(file);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'prescription');
      
      const uploadResponse = await apiClient.post<any>('/file-upload/prescription', formData);
      if (uploadResponse.success) {
        setPrescriptionUploaded(true);
        toast.success('Prescription uploaded successfully');
      }
    } catch (err: any) {
      console.error('Error uploading prescription:', err);
      toast.error('Failed to upload prescription');
    }
  };

  const handleAddToCart = (medicine: Medicine) => {
    if (medicine.prescription_required && !prescriptionUploaded) {
      toast.error('Prescription required for this medicine. Please upload prescription first.');
      return;
    }

    addToCart({
      id: medicine.id,
      name: medicine.name,
      price: medicine.price,
      quantity: 1,
      image: medicine.image,
      vendorId: 'pharmacy',
      vendorName: 'Pet Pharmacy',
      prescription_required: medicine.prescription_required
    });

    toast.success(`${medicine.name} added to cart`);
  };

  const filteredMedicines = medicines.filter(medicine => {
    const matchesSearch = medicine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      medicine.brand?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || true; // Category filtering can be enhanced
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ✅ FIX: Prepare stats for ServiceDashboardHeader
  const dashboardStats = [
    { value: `${stats.totalMedicines}+`, label: 'Medicines', icon: <Pill className="w-4 h-4" /> },
    { value: `${stats.orders}+`, label: 'Orders' },
    { value: `${stats.rating}`, label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* ✅ FIX: Restore Frame UI with ServiceDashboardHeader */}
      <ServiceDashboardHeader
        serviceName="Pharmacy Store"
        serviceSubtitle="Pet medicines & supplements"
        serviceIcon={Pill}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />
      
      {/* Search Bar - Below header */}
      <div className="px-4 pt-4 pb-2 bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search medicines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-lg text-gray-900 placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Prescription Upload Banner */}
        {medicines.some(m => m.prescription_required) && (
          <Card className="bg-blue-50 border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Prescription Required</h3>
                <p className="text-sm text-blue-700 mb-3">Some medicines require a valid prescription</p>
                {!prescriptionUploaded ? (
                  <label className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm font-medium">Upload Prescription</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handlePrescriptionUpload}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Prescription uploaded</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 ${selectedCategory === cat.id ? 'bg-blue-600 text-white' : ''}`}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Medicines List */}
        {filteredMedicines.length === 0 ? (
          <Card className="p-8 text-center">
            <Pill className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No medicines found</p>
            <p className="text-sm text-gray-400 mt-2">Try a different search term</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredMedicines.map((medicine) => (
              <Card key={medicine.id} className="p-4 hover:shadow-lg transition-shadow">
                {medicine.image ? (
                  <img 
                    src={medicine.image} 
                    alt={medicine.name}
                    className="w-full h-32 object-cover rounded-lg mb-3"
                  />
                ) : (
                  <div className="w-full h-32 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                    <Pill className="w-8 h-8 text-blue-600" />
                  </div>
                )}
                <h3 className="font-semibold text-sm text-gray-900 mb-1 line-clamp-2">{medicine.name}</h3>
                {medicine.brand && (
                  <p className="text-xs text-gray-600 mb-1">{medicine.brand}</p>
                )}
                {medicine.prescription_required && (
                  <div className="flex items-center gap-1 mb-2">
                    <AlertCircle className="w-3 h-3 text-orange-600" />
                    <span className="text-xs text-orange-600">Rx Required</span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-3">
                  <span className="font-bold text-blue-600">₹{medicine.price.toFixed(2)}</span>
                  <Button
                    size="sm"
                    onClick={() => handleAddToCart(medicine)}
                    disabled={medicine.prescription_required && !prescriptionUploaded}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                  >
                    Add
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
