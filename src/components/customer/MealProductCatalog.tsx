import { useState, useEffect } from 'react';
import { ArrowLeft, Package, Search, Filter, ShoppingCart, Star } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';

interface MealProduct {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  nutritionalValue: {
    protein?: string;
    fat?: string;
    fiber?: string;
    moisture?: string;
    calories?: string;
  };
  price: number;
  packSize: string;
  dietType: 'Non-Veg' | 'Veg' | 'Egg';
  suitableFor: string[];
  petTypes: string[];
  images?: string[];
  inStock?: boolean;
}

interface MealProductCatalogProps {
  vendorId: string;
  vendorName?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function MealProductCatalog({ vendorId, vendorName, onBack, onNavigate }: MealProductCatalogProps) {
  const [products, setProducts] = useState<MealProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dietTypeFilter, setDietTypeFilter] = useState<string>('all');
  const [suitableForFilter, setSuitableForFilter] = useState<string>('all');
  const [petTypeFilter, setPetTypeFilter] = useState<string>('all');

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadProducts();
  }, [vendorId, dietTypeFilter, suitableForFilter, petTypeFilter]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dietTypeFilter !== 'all') params.append('dietType', dietTypeFilter);
      if (suitableForFilter !== 'all') params.append('suitableFor', suitableForFilter);
      if (petTypeFilter !== 'all') params.append('petType', petTypeFilter);

      const response = await fetch(
        `${API_BASE}/customer/meals/${vendorId}/products?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        const productsList = data.products || data.data?.products || [];
        setProducts(productsList);
        console.log('✅ Loaded meal products:', productsList.length);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load products:', errorData);
        setProducts([]);
      }
    } catch (error: any) {
      console.error('Error loading products:', error);
      const errorMessage = error?.message || 'Failed to load meal products';
      toast.error(errorMessage);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.ingredients.some(ing => ing.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Meal Products</h1>
            {vendorName && <p className="text-sm text-gray-600">{vendorName}</p>}
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 pb-3 space-y-2">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setDietTypeFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-lg border whitespace-nowrap ${
                dietTypeFilter === 'all'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              All Diets
            </button>
            <button
              onClick={() => setDietTypeFilter('Non-Veg')}
              className={`px-3 py-1.5 text-sm rounded-lg border whitespace-nowrap ${
                dietTypeFilter === 'Non-Veg'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              Non-Veg
            </button>
            <button
              onClick={() => setDietTypeFilter('Veg')}
              className={`px-3 py-1.5 text-sm rounded-lg border whitespace-nowrap ${
                dietTypeFilter === 'Veg'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              Veg
            </button>
            <button
              onClick={() => setDietTypeFilter('Egg')}
              className={`px-3 py-1.5 text-sm rounded-lg border whitespace-nowrap ${
                dietTypeFilter === 'Egg'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              Egg
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setSuitableForFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-lg border whitespace-nowrap ${
                suitableForFilter === 'all'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              All Ages
            </button>
            <button
              onClick={() => setSuitableForFilter('Puppy')}
              className={`px-3 py-1.5 text-sm rounded-lg border whitespace-nowrap ${
                suitableForFilter === 'Puppy'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              Puppy
            </button>
            <button
              onClick={() => setSuitableForFilter('Adult')}
              className={`px-3 py-1.5 text-sm rounded-lg border whitespace-nowrap ${
                suitableForFilter === 'Adult'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              Adult
            </button>
            <button
              onClick={() => setSuitableForFilter('Senior')}
              className={`px-3 py-1.5 text-sm rounded-lg border whitespace-nowrap ${
                suitableForFilter === 'Senior'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              Senior
            </button>
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="p-4 space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No products found</p>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => onNavigate('product-detail', { product, vendorId })}
              className="bg-white rounded-xl p-4 border border-gray-200 hover:border-green-500 transition-colors cursor-pointer"
            >
              <div className="flex gap-3">
                {product.images && product.images.length > 0 ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                    <Package className="w-8 h-8 text-green-400" />
                  </div>
                )}
                
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{product.name}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">₹{product.price}</div>
                      {product.packSize && (
                        <div className="text-xs text-gray-500">{product.packSize}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      product.dietType === 'Non-Veg' ? 'bg-red-100 text-red-700' :
                      product.dietType === 'Veg' ? 'bg-green-100 text-green-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {product.dietType}
                    </span>
                    {product.suitableFor.map((age, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {age}
                      </span>
                    ))}
                    {product.petTypes.map((type, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                        {type}
                      </span>
                    ))}
                  </div>

                  {product.ingredients && product.ingredients.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      <span className="font-medium">Ingredients: </span>
                      <span>{product.ingredients.slice(0, 3).join(', ')}</span>
                      {product.ingredients.length > 3 && <span>...</span>}
                    </div>
                  )}

                  {product.nutritionalValue && (
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      {product.nutritionalValue.protein && (
                        <span>Protein: {product.nutritionalValue.protein}</span>
                      )}
                      {product.nutritionalValue.calories && (
                        <span>Calories: {product.nutritionalValue.calories}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

