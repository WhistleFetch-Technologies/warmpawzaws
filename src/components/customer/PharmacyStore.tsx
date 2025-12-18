import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ShoppingCart, 
  Plus, 
  Minus, 
  ArrowLeft,
  Star,
  Info
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { useCart } from '../../context/CartContext';
import { toast } from 'sonner@2.0.3';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  image: string;
  category: string;
  prescriptionRequired: boolean;
  vendorId: string;
  vendorName: string;
  inStock: boolean;
}

// Mock Data
const MOCK_PRODUCTS: Product[] = [
  {
    id: 'med-1',
    name: 'Apoquel 16mg',
    description: 'Allergy relief for dogs (10 tablets)',
    price: 850,
    originalPrice: 950,
    rating: 4.8,
    reviews: 124,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200',
    category: 'prescription',
    prescriptionRequired: true,
    vendorId: 'vendor-1',
    vendorName: 'PetMeds Pharmacy',
    inStock: true
  },
  {
    id: 'med-2',
    name: 'NexGard Spectra',
    description: 'Chewable tablets for fleas & ticks (Medium Dogs)',
    price: 1200,
    rating: 4.9,
    reviews: 89,
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=200',
    category: 'prescription',
    prescriptionRequired: true,
    vendorId: 'vendor-1',
    vendorName: 'PetMeds Pharmacy',
    inStock: true
  },
  {
    id: 'otc-1',
    name: 'Himalaya Erina EP',
    description: 'Tick and flea control shampoo (200ml)',
    price: 245,
    originalPrice: 275,
    rating: 4.5,
    reviews: 450,
    image: 'https://images.unsplash.com/photo-1583947581924-860b8f475059?auto=format&fit=crop&q=80&w=200',
    category: 'otc',
    prescriptionRequired: false,
    vendorId: 'vendor-2',
    vendorName: 'VetCare Pharmacy',
    inStock: true
  },
  {
    id: 'sup-1',
    name: 'Drools Absolute Calcium',
    description: 'Calcium supplement for healthy bones (50 tabs)',
    price: 350,
    rating: 4.6,
    reviews: 210,
    image: 'https://images.unsplash.com/photo-1585849834997-6da3b38eb391?auto=format&fit=crop&q=80&w=200',
    category: 'supplements',
    prescriptionRequired: false,
    vendorId: 'vendor-2',
    vendorName: 'VetCare Pharmacy',
    inStock: true
  },
  {
    id: 'acc-1',
    name: 'Elizabeth Collar',
    description: 'Protective collar for post-surgery recovery (Size M)',
    price: 450,
    rating: 4.3,
    reviews: 56,
    image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&q=80&w=200',
    category: 'accessories',
    prescriptionRequired: false,
    vendorId: 'vendor-3',
    vendorName: 'Healthy Paws',
    inStock: true
  },
  {
    id: 'med-3',
    name: 'Bravecto Spot On',
    description: 'Flea and tick protection for cats',
    price: 1800,
    originalPrice: 2000,
    rating: 4.9,
    reviews: 75,
    image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=200',
    category: 'prescription',
    prescriptionRequired: true,
    vendorId: 'vendor-1',
    vendorName: 'PetMeds Pharmacy',
    inStock: true
  }
];

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'prescription', label: 'Prescription' },
  { id: 'otc', label: 'OTC' },
  { id: 'supplements', label: 'Supplements' },
  { id: 'accessories', label: 'Accessories' }
];

interface PharmacyStoreProps {
  onBack: () => void;
  onNavigate: (screen: string) => void;
  initialCategory?: string;
}

export function PharmacyStore({ onBack, onNavigate, initialCategory = 'all' }: PharmacyStoreProps) {
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const { items, addToCart, itemCount, cartTotal } = useCart();
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);

  const filteredProducts = products.filter(product => {
    const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          product.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getQuantityInCart = (productId: string) => {
    return items.find(item => item.id === productId)?.quantity || 0;
  };

  return (
    <div className="min-h-screen bg-[#FF8C42] gray-50 pb-24">
      {/* Header */}
      <div className="bg-[#FF8C42] white sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-bold text-lg">Pharmacy Store</h1>
              <p className="text-xs text-gray-500">Delivering to Home</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative"
            onClick={() => onNavigate('pharmacy_checkout')}
          >
            <ShoppingCart className="w-6 h-6 text-gray-700" />
            {itemCount > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-[#FF8C42] red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                {itemCount}
              </span>
            )}
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="Search medicines, products..." 
              className="pl-9 bg-[#FF8C42] gray-50 border-gray-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Categories */}
        <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeCategory === cat.id 
                    ? 'bg-gray-900 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="p-4 grid grid-cols-2 gap-4">
        {filteredProducts.map(product => (
          <Card key={product.id} className="overflow-hidden bg-[#FF8C42] white border-gray-100 shadow-sm flex flex-col">
            <div className="relative aspect-square bg-[#FF8C42] gray-100">
              <img 
                src={product.image} 
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {product.prescriptionRequired && (
                <div className="absolute top-2 left-2 bg-[#FF8C42] blue-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  RX
                </div>
              )}
              {product.originalPrice && (
                <div className="absolute top-2 right-2 bg-[#FF8C42] red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                </div>
              )}
            </div>
            
            <div className="p-3 flex-1 flex flex-col">
              <div className="mb-1">
                <h3 className="font-semibold text-sm line-clamp-2 h-10">{product.name}</h3>
                <p className="text-xs text-gray-500 line-clamp-1">{product.description}</p>
              </div>
              
              <div className="flex items-center gap-1 mb-2">
                <Star className="w-3 h-3 text-amber-400 fill-current" />
                <span className="text-xs font-medium">{product.rating}</span>
                <span className="text-xs text-gray-400">({product.reviews})</span>
              </div>

              <div className="mt-auto flex items-end justify-between">
                <div>
                  <span className="font-bold text-gray-900">₹{product.price}</span>
                  {product.originalPrice && (
                    <span className="text-xs text-gray-400 line-through ml-1">₹{product.originalPrice}</span>
                  )}
                </div>
                
                <Button 
                  size="sm" 
                  className="h-8 w-8 p-0 rounded-full bg-pink-600 hover:bg-[#FF8C42] pink-700"
                  onClick={() => addToCart({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.image,
                    prescriptionRequired: product.prescriptionRequired,
                    vendorId: product.vendorId,
                    vendorName: product.vendorName
                  })}
                >
                  <Plus className="w-4 h-4 text-white" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-[#FF8C42] gray-100 rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-800">No products found</h3>
          <p className="text-gray-500 text-sm mt-1">Try adjusting your search or category</p>
        </div>
      )}

      {/* Floating Cart Summary */}
      {itemCount > 0 && (
        <div className="fixed bottom-6 left-4 right-4">
          <Button 
            className="w-full bg-gray-900 hover:bg-[#FF8C42] black text-white h-14 rounded-xl shadow-lg flex items-center justify-between px-6"
            onClick={() => onNavigate('pharmacy_checkout')}
          >
            <div className="flex flex-col items-start">
              <span className="text-xs text-gray-300">{itemCount} items</span>
              <span className="font-bold">₹{cartTotal}</span>
            </div>
            <div className="flex items-center gap-2 font-semibold">
              View Cart
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </div>
          </Button>
        </div>
      )}
    </div>
  );
}
