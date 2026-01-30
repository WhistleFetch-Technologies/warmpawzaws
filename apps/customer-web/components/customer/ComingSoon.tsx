'use client';

import { ArrowLeft, Search, Star, Heart, ShoppingCart, TrendingUp, Sparkles, Filter, Grid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
// ImageWithFallback component not found - using img tag instead
import { useState } from 'react';
import { useCart } from '@/context/CartContext';

interface ComingSoonProps {
  serviceName?: string;
  onBack: () => void;
}

const categories = [
  { id: 1, name: '🍖 Food', icon: '🍖' },
  { id: 2, name: '🎾 Toys', icon: '🎾' },
  { id: 3, name: '👕 Clothes', icon: '👕' },
  { id: 4, name: '🏥 Health', icon: '🏥' },
  { id: 5, name: '🛏️ Beds', icon: '🛏️' },
  { id: 6, name: '🎨 Accessories', icon: '🎨' },
  { id: 7, name: '🐠 Aquarium', icon: '🐠' },
  { id: 8, name: '🐦 Birds', icon: '🐦' },
];

const featuredProducts = [
  {
    id: 1,
    name: 'Premium Dog Food Bowl',
    price: 24.99,
    originalPrice: 34.99,
    rating: 4.8,
    reviews: 1240,
    image: 'https://images.unsplash.com/photo-1598134493179-51332e56807f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkb2clMjBmb29kJTIwYm93bHxlbnwxfHx8fDE3NjQ1ODEzNDZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'Best Seller',
    discount: 29,
    vendorId: 'vendor1',
    vendorName: 'PawSome Pets Store',
    vendorRating: 4.8,
    vendorReviews: 2340,
    deliveryTime: '2-3 days',
    inStock: true,
    freeDelivery: true,
    returnable: true,
    returnDays: 30,
    warranty: '1 Year'
  },
  {
    id: 2,
    name: 'Interactive Pet Toy Ball',
    price: 15.99,
    originalPrice: 19.99,
    rating: 4.6,
    reviews: 856,
    image: 'https://images.unsplash.com/photo-1703531297357-ab23f011e2b3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXQlMjB0b3lzJTIwYmFsbHxlbnwxfHx8fDE3NjQ2NzU0NjZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'Hot Deal',
    discount: 20,
    vendorId: 'vendor2',
    vendorName: 'Pet Paradise',
    vendorRating: 4.6,
    vendorReviews: 1820,
    deliveryTime: '1-2 days',
    inStock: true,
    freeDelivery: false,
    returnable: true,
    returnDays: 14,
    warranty: '6 Months'
  },
  {
    id: 3,
    name: 'Luxury Pet Collar & Leash Set',
    price: 32.99,
    originalPrice: 45.99,
    rating: 4.9,
    reviews: 2105,
    image: 'https://images.unsplash.com/photo-1577447278822-37801be21738?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkb2clMjBjb2xsYXIlMjBsZWFzaHxlbnwxfHx8fDE3NjQ1ODEzNDh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'Premium',
    discount: 28,
    vendorId: 'vendor1',
    vendorName: 'PawSome Pets Store',
    vendorRating: 4.8,
    vendorReviews: 2340,
    deliveryTime: '2-3 days',
    inStock: true,
    freeDelivery: true,
    returnable: true,
    returnDays: 30,
    warranty: '2 Years'
  },
  {
    id: 4,
    name: 'Cozy Cat Bed',
    price: 39.99,
    originalPrice: 55.99,
    rating: 4.7,
    reviews: 634,
    image: 'https://images.unsplash.com/photo-1430025120386-1e6f189a42a8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXQlMjBiZWQlMjBjb3p5fGVufDF8fHx8MTY0NjY3NTQ2N3ww&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'New Arrival',
    discount: 29,
    vendorId: 'vendor3',
    vendorName: 'Furry Friends Shop',
    vendorRating: 4.9,
    vendorReviews: 3100,
    deliveryTime: '3-4 days',
    inStock: true,
    freeDelivery: false,
    returnable: true,
    returnDays: 7,
    warranty: 'None'
  },
  {
    id: 5,
    name: 'Professional Grooming Brush',
    price: 18.99,
    originalPrice: 24.99,
    rating: 4.8,
    reviews: 1523,
    image: 'https://images.unsplash.com/photo-1625279138876-8910c2af9a30?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXQlMjBncm9vbWluZyUyMGJydXNofGVufDF8fHx8MTc2NDU3MDg2M3ww&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'Top Rated',
    discount: 24,
    vendorId: 'vendor2',
    vendorName: 'Pet Paradise',
    vendorRating: 4.6,
    vendorReviews: 1820,
    deliveryTime: '1-2 days',
    inStock: true,
    freeDelivery: false,
    returnable: true,
    returnDays: 14,
    warranty: '1 Year'
  },
  {
    id: 6,
    name: 'Natural Dog Treats Pack',
    price: 12.99,
    originalPrice: 16.99,
    rating: 4.9,
    reviews: 2891,
    image: 'https://images.unsplash.com/photo-1604544203292-0daa7f847478?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkb2clMjB0cmVhdHMlMjBzbmFja3N8ZW58MXx8fHwxNzY0NjY5NTM1fDA&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'Best Value',
    discount: 24,
    vendorId: 'vendor1',
    vendorName: 'PawSome Pets Store',
    vendorRating: 4.8,
    vendorReviews: 2340,
    deliveryTime: '2-3 days',
    inStock: true,
    freeDelivery: false,
    returnable: true,
    returnDays: 30,
    warranty: 'None'
  },
  {
    id: 7,
    name: 'Cat Scratching Post Tower',
    price: 49.99,
    originalPrice: 69.99,
    rating: 4.6,
    reviews: 428,
    image: 'https://images.unsplash.com/photo-1545249390-6bdfa286032f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXQlMjBzY3JhdGNoaW5nJTIwcG9zdHxlbnwxfHx8fDE3NjQ2MDEwMzF8MA&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'Trending',
    discount: 29,
    vendorId: 'vendor3',
    vendorName: 'Furry Friends Shop',
    vendorRating: 4.9,
    vendorReviews: 3100,
    deliveryTime: '3-4 days',
    inStock: true,
    freeDelivery: true,
    returnable: true,
    returnDays: 7,
    warranty: '6 Months'
  },
  {
    id: 8,
    name: 'Portable Pet Water Bottle',
    price: 14.99,
    originalPrice: 19.99,
    rating: 4.7,
    reviews: 967,
    image: 'https://images.unsplash.com/photo-1597350289957-120f34437361?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXQlMjB3YXRlciUyMGJvdHRsZXxlbnwxfHx8fDE3NjQ2NDQ2ODZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'Eco-Friendly',
    discount: 25,
    vendorId: 'vendor2',
    vendorName: 'Pet Paradise',
    vendorRating: 4.6,
    vendorReviews: 1820,
    deliveryTime: '1-2 days',
    inStock: true,
    freeDelivery: false,
    returnable: true,
    returnDays: 14,
    warranty: 'None'
  },
  {
    id: 9,
    name: 'Winter Dog Sweater',
    price: 28.99,
    originalPrice: 39.99,
    rating: 4.8,
    reviews: 745,
    image: 'https://images.unsplash.com/photo-1759414367816-ed179fa77106?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkb2clMjBzd2VhdGVyJTIwY2xvdGhlc3xlbnwxfHx8fDE3NjQ2NzU0Njl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'Seasonal',
    discount: 28,
    vendorId: 'vendor1',
    vendorName: 'PawSome Pets Store',
    vendorRating: 4.8,
    vendorReviews: 2340,
    deliveryTime: '2-3 days',
    inStock: true,
    freeDelivery: true,
    returnable: true,
    returnDays: 30,
    warranty: '1 Year'
  },
  {
    id: 10,
    name: 'Pet Travel Carrier Bag',
    price: 44.99,
    originalPrice: 59.99,
    rating: 4.7,
    reviews: 512,
    image: 'https://images.unsplash.com/photo-1608060375223-c5ab552bc9a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXQlMjBjYXJyaWVyJTIwYmFnfGVufDF8fHx8MTc2NDY3NTQ3MHww&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'Travel Essential',
    discount: 25,
    vendorId: 'vendor2',
    vendorName: 'Pet Paradise',
    vendorRating: 4.6,
    vendorReviews: 1820,
    deliveryTime: '1-2 days',
    inStock: true,
    freeDelivery: false,
    returnable: true,
    returnDays: 14,
    warranty: '1 Year'
  },
  {
    id: 11,
    name: 'Aquarium Starter Kit',
    price: 89.99,
    originalPrice: 119.99,
    rating: 4.6,
    reviews: 389,
    image: 'https://images.unsplash.com/photo-1642375143840-0c7e9db07b40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcXVhcml1bSUyMGZpc2glMjB0YW5rfGVufDF8fHx8MTc2NDU4OTQ4OXww&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'Complete Set',
    discount: 25,
    vendorId: 'vendor3',
    vendorName: 'Furry Friends Shop',
    vendorRating: 4.9,
    vendorReviews: 3100,
    deliveryTime: '3-4 days',
    inStock: true,
    freeDelivery: true,
    returnable: true,
    returnDays: 7,
    warranty: '6 Months'
  },
  {
    id: 12,
    name: 'Bird Cage with Perch',
    price: 65.99,
    originalPrice: 84.99,
    rating: 4.8,
    reviews: 267,
    image: 'https://images.unsplash.com/photo-1759600655585-1f1cdd19d589?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiaXJkJTIwY2FnZSUyMHBlcmNofGVufDF8fHx8MTc2NDY3NTQ3MHww&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'Spacious',
    discount: 22,
    vendorId: 'vendor1',
    vendorName: 'PawSome Pets Store',
    vendorRating: 4.8,
    vendorReviews: 2340,
    deliveryTime: '2-3 days',
    inStock: true,
    freeDelivery: false,
    returnable: true,
    returnDays: 30,
    warranty: '1 Year'
  },
];

export function ComingSoon({ serviceName, onBack }: ComingSoonProps) {
  const { addToCart } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Format service name for display
  const formattedName = serviceName
    ? serviceName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : 'Pet Products';

  const handleAddToCart = (product: typeof featuredProducts[0]) => {
    addToCart({
      id: product.id.toString(),
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.image,
      vendorId: product.vendorId,
      vendorName: product.vendorName,
      vendorRating: product.vendorRating,
      vendorReviews: product.vendorReviews,
      originalPrice: product.originalPrice,
      discount: product.discount,
      deliveryTime: product.deliveryTime,
      inStock: product.inStock,
      freeDelivery: product.freeDelivery,
      returnable: product.returnable,
      returnDays: product.returnDays,
      warranty: product.warranty,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white shadow-md sticky top-0 z-10 rounded-b-2xl">
        <div className="flex items-center gap-3 px-6 py-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">{formattedName}</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col pb-6">
        {/* Search Bar */}
        <div className="px-4 pt-4 pb-3 bg-white sticky top-[60px] z-10 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for pet products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
            />
            <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Filter className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Promotional Banner */}
        <div className="mx-4 mt-4 bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5" />
                <span className="text-xs uppercase tracking-wide">Limited Time Offer</span>
              </div>
              <h3 className="text-xl mb-1">Mega Pet Sale!</h3>
              <p className="text-sm opacity-90">Up to 50% off on selected items</p>
            </div>
            <div className="bg-white text-[#FF8C42] px-4 py-2 rounded-full">
              <span className="text-xs">Shop Now</span>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Shop by Category</h3>
            <button className="text-[#FF8C42] text-sm">See All</button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full border ${
                  selectedCategory === category.id
                    ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-[#FF8C42]'
                } transition-all`}
              >
                <span className="text-sm whitespace-nowrap">{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Deals of the Day */}
        <div className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#FF8C42]" />
              <h3 className="font-semibold text-gray-900">Deals of the Day</h3>
            </div>
            <button className="text-[#FF8C42] text-sm">View All</button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {featuredProducts.slice(0, 4).map((product) => (
              <div key={product.id} className="flex-shrink-0 w-[160px] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="relative">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-[140px] object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    -{product.discount}%
                  </div>
                  <button className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-50">
                    <Heart className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <div className="p-3">
                  <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">{product.name}</h4>
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs text-gray-600">{product.rating}</span>
                    <span className="text-xs text-gray-400">({product.reviews})</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="font-semibold text-[#FF8C42]">${product.price}</span>
                    <span className="text-xs text-gray-400 line-through">${product.originalPrice}</span>
                  </div>
                  <button 
                    onClick={() => handleAddToCart(product)}
                    className="w-full bg-[#FF8C42] text-white text-xs py-2 rounded-lg hover:bg-[#FF7A2E] transition-colors"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">All Products</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Products Grid */}
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}>
            {featuredProducts.map((product) => (
              viewMode === 'grid' ? (
                <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="relative">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-[160px] object-cover"
                    />
                    <div className="absolute top-2 left-2">
                      <span className="bg-[#FF8C42] text-white text-xs px-2 py-1 rounded-full">
                        {product.badge}
                      </span>
                    </div>
                    <button className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-50">
                      <Heart className="w-4 h-4 text-gray-600" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      -{product.discount}%
                    </div>
                  </div>
                  <div className="p-3">
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">{product.name}</h4>
                    <div className="flex items-center gap-1 mb-2">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs text-gray-600">{product.rating}</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="font-semibold text-[#FF8C42]">${product.price}</span>
                      <span className="text-xs text-gray-400 line-through">${product.originalPrice}</span>
                    </div>
                    <button 
                      onClick={() => handleAddToCart(product)}
                      className="w-full bg-[#FF8C42] text-white text-xs py-2 rounded-lg hover:bg-[#FF7A2E] transition-colors flex items-center justify-center gap-1"
                    >
                      <ShoppingCart className="w-3 h-3" />
                      Add to Cart
                    </button>
                  </div>
                </div>
              ) : (
                <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex">
                  <div className="relative w-32 flex-shrink-0">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      -{product.discount}%
                    </div>
                  </div>
                  <div className="flex-1 p-3 flex flex-col">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{product.name}</h4>
                      <button className="ml-2">
                        <Heart className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                    <div className="inline-block mb-2">
                      <span className="bg-[#FF8C42] text-white text-xs px-2 py-0.5 rounded-full">
                        {product.badge}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mb-2">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs text-gray-600">{product.rating}</span>
                      <span className="text-xs text-gray-400">({product.reviews} reviews)</span>
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-[#FF8C42]">${product.price}</span>
                        <span className="text-xs text-gray-400 line-through">${product.originalPrice}</span>
                      </div>
                      <button 
                        onClick={() => handleAddToCart(product)}
                        className="bg-[#FF8C42] text-white text-xs px-4 py-2 rounded-lg hover:bg-[#FF7A2E] transition-colors flex items-center gap-1"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>

        {/* Load More */}
        <div className="px-4 mt-6">
          <button className="w-full py-3 border-2 border-[#FF8C42] text-[#FF8C42] rounded-full hover:bg-[#FF8C42] hover:text-white transition-all">
            Load More Products
          </button>
        </div>
      </div>

      {/* Bottom Decorative Element */}
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
    </div>
  );
}