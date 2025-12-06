import { useState, useEffect } from 'react';
import { Search, Filter, ChevronDown, X, SlidersHorizontal, ShoppingBag } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { ProductCard, Product } from './ProductCard';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../../ui/sheet';
import { Slider } from '../../ui/slider';
import { Checkbox } from '../../ui/checkbox';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner@2.0.3';

import { ProductDetail } from './ProductDetail';

interface ProductBrowsingProps {
  onProductClick?: (productId: string) => void;
  customerId?: string;
  onOrdersClick?: () => void;
}

export function ProductBrowsing({ onProductClick, customerId, onOrdersClick }: ProductBrowsingProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // ... filters state ...

  // If viewing detail, show that instead
  if (selectedProductId) {
    return (
      <ProductDetail 
        productId={selectedProductId} 
        onBack={() => setSelectedProductId(null)} 
        customerId={customerId || 'guest'}
      />
    );
  }

  // ... rest of existing code ...
  const [categories, setCategories] = useState<string[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [selectedPetTypes, setSelectedPetTypes] = useState<string[]>([]);
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, showInStockOnly, sortBy, searchQuery]); // Debounce search in real app

  const fetchCategories = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/categories`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        // Assuming data.categories is array of objects or strings
        const catNames = data.categories?.map((c: any) => typeof c === 'string' ? c : c.name) || [];
        setCategories(['all', ...catNames]);
      }
    } catch (e) {
      console.error('Failed to load categories', e);
      // Fallback categories
      setCategories(['all', 'Food', 'Toys', 'Grooming', 'Health', 'Accessories']);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (showInStockOnly) params.append('inStock', 'true');
      
      // Note: Price and PetType filtering might be client-side if API doesn't support it yet
      // But let's assume we fetch generic list and filter client-side for now if API is limited
      
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/products?${params.toString()}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      
      if (res.ok) {
        const data = await res.json();
        let fetchedProducts = data.products || [];
        
        // Client-side filtering for advanced filters if backend doesn't fully support them yet
        if (selectedPetTypes.length > 0) {
           fetchedProducts = fetchedProducts.filter((p: Product) => 
             // Check if product tags or specific petType field matches
             // Assuming product has petTypes array or similar
             true // Placeholder until data structure confirmed
           );
        }
        
        // Sort
        if (sortBy === 'price_asc') {
          fetchedProducts.sort((a: Product, b: Product) => (a.salePrice || a.basePrice) - (b.salePrice || b.basePrice));
        } else if (sortBy === 'price_desc') {
          fetchedProducts.sort((a: Product, b: Product) => (b.salePrice || b.basePrice) - (a.salePrice || a.basePrice));
        }

        setProducts(fetchedProducts);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (productId: string) => {
    if (!customerId) {
      toast.error("Please login to add items");
      return;
    }
    
    // Optimistic UI could be added here, but for now let's just call API
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/cart/add`,
        {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
             customerId,
             productId,
             quantity: 1
          })
        }
      );
      
      if (res.ok) {
        toast.success("Added to cart");
      } else {
        toast.error("Failed to add to cart");
      }
    } catch (error) {
      console.error('Add to cart error:', error);
      toast.error("Something went wrong");
    }
  };

  const FilterContent = () => (
    <div className="space-y-6 py-4">
      {/* Categories */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm">Categories</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <Badge 
              key={cat} 
              variant={selectedCategory === cat ? 'default' : 'outline'}
              className="cursor-pointer capitalize"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Badge>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <h3 className="font-medium">Price Range</h3>
          <span className="text-gray-500">₹{priceRange[0]} - ₹{priceRange[1]}+</span>
        </div>
        <Slider 
          defaultValue={[0, 10000]} 
          max={10000} 
          step={100}
          value={priceRange}
          onValueChange={setPriceRange}
        />
      </div>

      {/* Pet Type */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm">Pet Type</h3>
        <div className="space-y-2">
          {['Dog', 'Cat', 'Bird', 'Fish', 'Small Pet'].map(type => (
            <div key={type} className="flex items-center space-x-2">
              <Checkbox 
                id={`pet-${type}`} 
                checked={selectedPetTypes.includes(type)}
                onCheckedChange={(checked) => {
                  if (checked) setSelectedPetTypes([...selectedPetTypes, type]);
                  else setSelectedPetTypes(selectedPetTypes.filter(t => t !== type));
                }}
              />
              <label htmlFor={`pet-${type}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {type}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Other Filters */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="instock" 
            checked={showInStockOnly}
            onCheckedChange={(c) => setShowInStockOnly(!!c)}
          />
          <label htmlFor="instock" className="text-sm font-medium">In Stock Only</label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header / Search */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm px-4 py-3">
        <div className="flex gap-2 max-w-md mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder="Search for food, toys..." 
              className="pl-9 bg-gray-100 border-none focus:bg-white transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Filter Sheet (Mobile) */}
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="shrink-0 text-gray-500" onClick={onOrdersClick}>
              <ShoppingBag className="w-5 h-5" />
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </Button>
              </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <FilterContent />
              <div className="mt-6 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setSelectedCategory('all');
                  setPriceRange([0, 10000]);
                  setSelectedPetTypes([]);
                }}>Reset</Button>
                <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700">Apply</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

        {/* Quick Categories (Horizontal Scroll) */}
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1 scrollbar-hide max-w-md mx-auto">
          {categories.slice(0, 6).map(cat => (
             <button
               key={cat}
               onClick={() => setSelectedCategory(cat)}
               className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                 selectedCategory === cat 
                   ? 'bg-indigo-600 text-white' 
                   : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
               }`}
             >
               {cat === 'all' ? 'All Products' : cat}
             </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="p-4 max-w-md mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-900">
            {selectedCategory === 'all' ? 'Recommended For You' : selectedCategory}
          </h2>
          <select 
            className="text-xs border-none bg-transparent text-gray-500 font-medium focus:ring-0 cursor-pointer"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="popular">Popular</option>
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="bg-white rounded-xl h-64 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">No products found</h3>
            <p className="text-sm">Try changing your filters or search terms</p>
            <Button 
              variant="link" 
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="text-indigo-600 mt-2"
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {products.map(product => (
              <div 
                key={product.id} 
                onClick={() => setSelectedProductId(product.id)} 
                className="cursor-pointer"
              >
                <ProductCard 
                  product={product} 
                  onAddToCart={(productId, e) => {
                    e?.stopPropagation();
                    handleAddToCart(productId);
                  }}
                  className="h-full"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
