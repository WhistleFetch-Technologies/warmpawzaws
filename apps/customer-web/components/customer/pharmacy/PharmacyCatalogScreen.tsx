'use client';

/**
 * ============================================================================
 * PHARMACY CATALOG SCREEN
 * ============================================================================
 * 
 * Browse counter medicines (OTC, Ayurvedic, Homeopathy) from seller hub
 * Only shows medicines and nutrition category items
 * 
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Pill, ShoppingCart, Filter, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Medicine {
  id: string;
  name: string;
  brand?: string;
  category: 'medicine' | 'nutrition';
  type: 'otc' | 'ayurvedic' | 'homeopathy' | 'supplement';
  price: number;
  image?: string;
  in_stock: boolean;
  description?: string;
}

interface PharmacyCatalogScreenProps {
  phone: string;
  customerId: string;
  onBack?: () => void;
  onAddToCart?: (items: Array<{ medicineId: string; quantity: number }>) => void;
}

export function PharmacyCatalogScreen({
  phone,
  customerId,
  onBack,
  onAddToCart
}: PharmacyCatalogScreenProps) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'otc' | 'ayurvedic' | 'homeopathy' | 'supplement'>('all');
  const [cart, setCart] = useState<Record<string, number>>({});

  useEffect(() => {
    loadMedicines();
  }, []);

  const loadMedicines = async () => {
    setLoading(true);
    try {
      // Fetch medicines from seller hub (medicine and nutrition categories only)
      const queryParams = new URLSearchParams({
        category: 'medicine,nutrition',
        type: 'counter_medicine'
      });
      const response = await apiClient.get<any>(`/seller/products?${queryParams.toString()}`);

      if (response?.products || response?.medicines) {
        const medicineList = response.products || response.medicines || [];
        setMedicines(medicineList.filter((m: any) => m.in_stock !== false));
      }
    } catch (error: any) {
      console.error('Error loading medicines:', error);
      toast.error('Failed to load medicines');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (medicineId: string) => {
    setCart(prev => ({
      ...prev,
      [medicineId]: (prev[medicineId] || 0) + 1
    }));
    toast.success('Added to cart');
  };

  const handleRemoveFromCart = (medicineId: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[medicineId] > 1) {
        newCart[medicineId] -= 1;
      } else {
        delete newCart[medicineId];
      }
      return newCart;
    });
  };

  const handleProceedToCheckout = () => {
    const cartItems = Object.entries(cart).map(([medicineId, quantity]) => ({
      medicineId,
      quantity
    }));

    if (cartItems.length === 0) {
      toast.error('Please add medicines to cart');
      return;
    }

    if (onAddToCart) {
      onAddToCart(cartItems);
    }
  };

  const filteredMedicines = medicines.filter(medicine => {
    const matchesSearch = medicine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      medicine.brand?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || medicine.type === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [medicineId, quantity]) => {
    const medicine = medicines.find(m => m.id === medicineId);
    return sum + (medicine ? medicine.price * quantity : 0);
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-br from-blue-500 to-blue-600 pb-6 pl-[max(1.5rem,env(safe-area-inset-left,0px))] pr-[max(1.5rem,env(safe-area-inset-right,0px))] text-white cw-header-safe-top">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 flex min-h-[44px] items-center gap-2 text-white/90 hover:text-white touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
        )}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Medicine Catalog</h1>
              <p className="text-white/90 text-sm">Counter medicines & supplements</p>
            </div>
          </div>
          {cartCount > 0 && (
            <Badge className="bg-white text-blue-600 text-lg px-3 py-1">
              {cartCount}
            </Badge>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search medicines..."
            className="pl-10 bg-white/90 border-0"
          />
        </div>
      </div>

      {/* Category Filters */}
      <div className="sticky top-[250px] z-10 border-b bg-white px-6 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'otc', label: 'OTC' },
            { id: 'ayurvedic', label: 'Ayurvedic' },
            { id: 'homeopathy', label: 'Homeopathy' },
            { id: 'supplement', label: 'Supplements' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Medicines List */}
      <div className="px-6 py-4 space-y-4 pb-24">
        {loading ? (
          <div className="text-center py-12">
            <Pill className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-500">Loading medicines...</p>
          </div>
        ) : filteredMedicines.length === 0 ? (
          <Card className="p-8 text-center">
            <Pill className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No medicines found</p>
          </Card>
        ) : (
          filteredMedicines.map(medicine => (
            <Card key={medicine.id} className="p-4">
              <div className="flex gap-4">
                {medicine.image && (
                  <img
                    src={medicine.image}
                    alt={medicine.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{medicine.name}</h3>
                  {medicine.brand && (
                    <p className="text-xs text-gray-600 mb-2">{medicine.brand}</p>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {medicine.type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-600">₹{medicine.price}</span>
                    {cart[medicine.id] ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRemoveFromCart(medicine.id)}
                          className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-semibold w-8 text-center">{cart[medicine.id]}</span>
                        <button
                          onClick={() => handleAddToCart(medicine.id)}
                          className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(medicine.id)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Cart Footer */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t shadow-lg p-4 z-20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-600">Total ({cartCount} items)</p>
              <p className="text-xl font-bold text-gray-900">₹{cartTotal.toFixed(2)}</p>
            </div>
            <Button
              onClick={handleProceedToCheckout}
              className="bg-blue-600 hover:bg-blue-700 px-6"
            >
              Proceed to Checkout
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
