import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, ShoppingCart, ArrowLeft, TrendingUp, Star, Heart, Package, Truck, Shield, Zap, MapPin, Store, Dog, ShoppingBag, Bone, Shirt, Watch, Pill, Scissors, Bed, UtensilsCrossed } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { useCart } from '../../context/CartContext';

interface ShopDashboardProps {
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  phone?: string;
}

export function ShopDashboard({ onBack, onNavigate, phone }: ShopDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const { itemCount } = useCart();

  // Auto-slide banners every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const banners = [
    {
      title: '🎉 MEGA SALE',
      subtitle: 'Up to 50% OFF on Pet Food',
      bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      cta: 'Shop Now'
    },
    {
      title: '🏃 FREE DELIVERY',
      subtitle: 'On orders above ₹999',
      bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      cta: 'Explore'
    },
    {
      title: '🎁 NEW ARRIVALS',
      subtitle: 'Latest toys & accessories',
      bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      cta: 'View All'
    }
  ];

  const categories = [
    { id: 'all', label: 'All', icon: <Store className="w-5 h-5 text-gray-600" />, color: 'bg-gray-100 text-gray-700' },
    { id: 'food', label: 'Food', icon: <Bone className="w-5 h-5 text-orange-600" />, color: 'bg-orange-100 text-orange-700' },
    { id: 'toys', label: 'Toys', icon: <Dog className="w-5 h-5 text-blue-600" />, color: 'bg-blue-100 text-blue-700' },
    { id: 'clothes', label: 'Clothes', icon: <Shirt className="w-5 h-5 text-teal-600" />, color: 'bg-teal-100 text-teal-700' },
    { id: 'accessories', label: 'Accessories', icon: <Watch className="w-5 h-5 text-pink-600" />, color: 'bg-pink-100 text-pink-700' },
    { id: 'medicine', label: 'Medicine', icon: <Pill className="w-5 h-5 text-red-600" />, color: 'bg-red-100 text-red-700' },
    { id: 'grooming', label: 'Grooming', icon: <Scissors className="w-5 h-5 text-purple-600" />, color: 'bg-purple-100 text-purple-700' },
    { id: 'beds', label: 'Beds', icon: <Bed className="w-5 h-5 text-indigo-600" />, color: 'bg-indigo-100 text-indigo-700' },
    { id: 'bowls', label: 'Bowls', icon: <UtensilsCrossed className="w-5 h-5 text-green-600" />, color: 'bg-green-100 text-green-700' }
  ];

  const hotDeals = [
    {
      name: 'Royal Canin Adult Dog Food',
      price: '₹2,499',
      originalPrice: '₹3,499',
      discount: '30%',
      rating: 4.8,
      reviews: 1240,
      image: '🍖',
      stock: 'In Stock',
      badge: 'Bestseller',
      vendor: {
        name: 'PetMart India',
        rating: 4.7,
        location: 'Mumbai',
        deliveryTime: '2-3 days'
      }
    },
    {
      name: 'Automatic Pet Feeder',
      price: '₹3,999',
      originalPrice: '₹5,999',
      discount: '35%',
      rating: 4.6,
      reviews: 856,
      image: '🤖',
      stock: 'Limited',
      badge: 'Trending',
      vendor: {
        name: 'Pet Tech Store',
        rating: 4.8,
        location: 'Delhi',
        deliveryTime: '1-2 days'
      }
    },
    {
      name: 'GPS Pet Collar Tracker',
      price: '₹4,299',
      originalPrice: '₹6,999',
      discount: '40%',
      rating: 4.9,
      reviews: 2103,
      image: '📍',
      stock: 'In Stock',
      badge: 'Hot Deal',
      vendor: {
        name: 'Gadgets4Pets',
        rating: 4.9,
        location: 'Bangalore',
        deliveryTime: '2-4 days'
      }
    },
    {
      name: 'Premium Pet Carrier Bag',
      price: '₹1,799',
      originalPrice: '₹2,999',
      discount: '40%',
      rating: 4.7,
      reviews: 567,
      image: '🎒',
      stock: 'In Stock',
      badge: 'New',
      vendor: {
        name: 'Pet Accessories Hub',
        rating: 4.6,
        location: 'Pune',
        deliveryTime: '3-5 days'
      }
    }
  ];

  const topProducts = [
    {
      name: 'Pedigree Adult Dry Dog Food',
      price: '₹1,899',
      rating: 4.5,
      image: '🍗',
      category: 'Food',
      vendor: {
        name: 'Pet Food World',
        rating: 4.5,
        location: 'Chennai',
        deliveryTime: '1-2 days'
      }
    },
    {
      name: 'Kong Classic Dog Toy',
      price: '₹899',
      rating: 4.9,
      image: '🎾',
      category: 'Toys',
      vendor: {
        name: 'Toy Kingdom Pets',
        rating: 4.8,
        location: 'Hyderabad',
        deliveryTime: '2-3 days'
      }
    },
    {
      name: 'Furminator Deshedding Tool',
      price: '₹2,499',
      rating: 4.8,
      image: '🪮',
      category: 'Grooming',
      vendor: {
        name: 'Groom & Care',
        rating: 4.7,
        location: 'Mumbai',
        deliveryTime: '1-3 days'
      }
    },
    {
      name: 'Orthopedic Pet Bed',
      price: '₹3,499',
      rating: 4.7,
      image: '🛏️',
      category: 'Beds',
      vendor: {
        name: 'Comfort Pet Store',
        rating: 4.9,
        location: 'Kolkata',
        deliveryTime: '3-5 days'
      }
    },
    {
      name: 'Stainless Steel Pet Bowl',
      price: '₹599',
      rating: 4.6,
      image: '🥣',
      category: 'Bowls',
      vendor: {
        name: 'Kitchen Pets',
        rating: 4.4,
        location: 'Ahmedabad',
        deliveryTime: '2-4 days'
      }
    },
    {
      name: 'LED Safety Collar',
      price: '₹799',
      rating: 4.4,
      image: '💡',
      category: 'Accessories',
      vendor: {
        name: 'SafePets Store',
        rating: 4.6,
        location: 'Jaipur',
        deliveryTime: '3-6 days'
      }
    }
  ];

  const brands = [
    { name: 'Royal Canin', logo: '👑' },
    { name: 'Pedigree', logo: '🦴' },
    { name: 'Whiskas', logo: '🐱' },
    { name: 'Drools', logo: '💧' },
    { name: 'Purepet', logo: '🐾' },
    { name: 'Farmina', logo: '🌾' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto relative">
      {/* Header with Search */}
      <div className="bg-white sticky top-0 z-50 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-gray-900 flex-1">Shop</h1>
            <button 
              onClick={() => onNavigate?.('cart')}
              className="relative p-2 hover:bg-gray-100 rounded-full"
            >
              <ShoppingCart className="w-5 h-5 text-gray-700" />
              {itemCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF8C42] rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">{itemCount}</span>
                </div>
              )}
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search products, brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-12 h-12 bg-gray-50 border-gray-200"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg">
              <SlidersHorizontal className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-[#FF8C42] text-white'
                    : cat.color + ' hover:shadow-sm'
                }`}
              >
                <span className="mr-1">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pb-24">
        {/* Hero Banner Carousel */}
        <div className="p-4">
          <div className="relative h-44 rounded-3xl overflow-hidden shadow-lg">
            {/* Banner slides */}
            <div 
              className="flex transition-transform duration-500 ease-in-out h-full"
              style={{ transform: `translateX(-${currentBannerIndex * 100}%)` }}
            >
              {banners.map((banner, index) => (
                <div
                  key={index}
                  className="min-w-full h-full"
                  style={{ background: banner.bg }}
                >
                  <div className="h-full flex items-center justify-between px-6">
                    <div className="flex-1">
                      <h2 className="text-white mb-1">{banner.title}</h2>
                      <p className="text-white/90 mb-3">{banner.subtitle}</p>
                      <button className="bg-white text-gray-900 px-6 py-2 rounded-full font-medium hover:shadow-lg transition-shadow">
                        {banner.cta}
                      </button>
                    </div>
                    <div className="text-6xl">🛍️</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
              {banners.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentBannerIndex(index)}
                  className={`transition-all ${
                    index === currentBannerIndex
                      ? 'w-6 h-2 bg-white'
                      : 'w-2 h-2 bg-white/50'
                  } rounded-full`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Quick Features */}
        <div className="px-4 mb-6">
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: Truck, label: 'Free Delivery', color: 'text-blue-600' },
              { icon: Shield, label: '100% Genuine', color: 'text-green-600' },
              { icon: Zap, label: 'Fast Shipping', color: 'text-orange-600' },
              { icon: Package, label: 'Easy Returns', color: 'text-purple-600' }
            ].map((feature, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-3 text-center shadow-sm">
                <feature.icon className={`w-6 h-6 mx-auto mb-1 ${feature.color}`} />
                <p className="text-xs text-gray-700 leading-tight">{feature.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Featured Vendors Section */}
        <div className="mb-6">
          <div className="px-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-[#FF8C42]" />
              <h2 className="font-bold text-gray-900">✨ Featured Vendors</h2>
            </div>
            <button className="text-[#FF8C42] text-sm font-medium flex items-center gap-1">
              View All <span>→</span>
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4">
            {[
              { name: 'PetMart India', rating: 4.7, products: '1500+', logo: '🏪', verified: true },
              { name: 'Pet Tech Store', rating: 4.8, products: '800+', logo: '🤖', verified: true },
              { name: 'Gadgets4Pets', rating: 4.9, products: '1200+', logo: '⚡', verified: true },
              { name: 'Groom & Care', rating: 4.7, products: '600+', logo: '✨', verified: true }
            ].map((vendor, idx) => (
              <Card key={idx} className="flex-shrink-0 w-36 p-4 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="text-center">
                  <div className="text-4xl mb-2">{vendor.logo}</div>
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">{vendor.name}</h3>
                  {vendor.verified && (
                    <div className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full mb-2">
                      <Shield className="w-3 h-3" />
                      <span>Verified</span>
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-medium">{vendor.rating}</span>
                  </div>
                  <p className="text-xs text-gray-500">{vendor.products} products</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Hot Deals Section */}
        <div className="mb-6">
          <div className="px-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-red-600" />
              <h2 className="font-bold text-gray-900">🔥 Hot Deals</h2>
            </div>
            <button className="text-[#FF8C42] text-sm font-medium flex items-center gap-1">
              View All <span>→</span>
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4">
            {hotDeals.map((deal, index) => (
              <Card 
                key={index} 
                onClick={() => onNavigate?.('product_detail', { 
                  product: { 
                    id: `deal-${index}`, 
                    ...deal,
                    description: `Premium quality ${deal.name}. ${deal.badge} item with ${deal.discount} discount.`,
                    category: 'Pet Products'
                  }
                })}
                className="flex-shrink-0 w-48 overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
              >
                {/* Product Image */}
                <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 relative flex items-center justify-center text-6xl">
                  {deal.image}
                  {deal.badge && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                      {deal.badge}
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                    {deal.discount} OFF
                  </div>
                  <button className="absolute bottom-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                    <Heart className="w-4 h-4 text-gray-700" />
                  </button>
                </div>

                {/* Product Info */}
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-2">{deal.name}</h3>
                  
                  {/* Vendor Info */}
                  <div className="flex items-center gap-1 mb-2 text-xs">
                    <Store className="w-3 h-3 text-gray-500" />
                    <span className="text-gray-600 font-medium">{deal.vendor.name}</span>
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 ml-1" />
                    <span className="text-gray-600">{deal.vendor.rating}</span>
                  </div>

                  <div className="flex items-center gap-1 mb-2">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-medium text-gray-900">{deal.rating}</span>
                    <span className="text-xs text-gray-500">({deal.reviews})</span>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[#FF8C42] font-bold">{deal.price}</span>
                      <span className="text-gray-400 line-through text-sm">{deal.originalPrice}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-medium ${deal.stock === 'In Stock' ? 'text-green-600' : 'text-orange-600'}`}>
                        {deal.stock}
                      </span>
                      <span className="text-gray-500 flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        {deal.vendor.deliveryTime}
                      </span>
                    </div>
                  </div>

                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.('product_detail', { 
                        product: { 
                          id: `deal-${index}`, 
                          ...deal,
                          description: `Premium quality ${deal.name}`,
                          category: 'Pet Products'
                        }
                      });
                    }}
                    className="w-full bg-[#FF8C42] hover:bg-[#FF7A2A] h-9 text-sm"
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Shop by Brand */}
        <div className="mb-6">
          <div className="px-4 mb-4">
            <h2 className="font-bold text-gray-900">Shop by Brand</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4">
            {brands.map((brand, index) => (
              <button
                key={index}
                className="flex-shrink-0 w-20 h-20 bg-white rounded-2xl flex flex-col items-center justify-center gap-1 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-2xl">{brand.logo}</div>
                <span className="text-xs font-medium text-gray-700 text-center px-1 leading-tight">{brand.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Top Products Grid */}
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Top Products</h2>
            <button className="text-[#FF8C42] text-sm font-medium">View All →</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {topProducts.map((product, index) => (
              <Card 
                key={index} 
                onClick={() => onNavigate?.('product_detail', { 
                  product: { 
                    id: `product-${index}`, 
                    ...product,
                    description: `Premium ${product.name} for your beloved pets`,
                    originalPrice: (Number(product.price.replace('₹', '').replace(',', '')) * 1.3).toFixed(0),
                    discount: '23%',
                    reviews: Math.floor(Math.random() * 1000) + 100,
                    stock: 'In Stock'
                  }
                })}
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="h-36 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-5xl relative">
                  {product.image}
                  <button className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md">
                    <Heart className="w-4 h-4 text-gray-700" />
                  </button>
                </div>
                <div className="p-3">
                  <div className="text-xs text-gray-500 mb-1">{product.category}</div>
                  <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-2">{product.name}</h3>
                  
                  {/* Vendor Badge */}
                  <div className="flex items-center gap-1 mb-2">
                    <div className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Store className="w-3 h-3" />
                      <span className="font-medium">{product.vendor.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mb-2">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-medium">{product.rating}</span>
                    <span className="text-xs text-gray-400 ml-1">• {product.vendor.deliveryTime}</span>
                  </div>
                  <p className="text-[#FF8C42] font-bold mb-2">{product.price}</p>
                  <Button className="w-full bg-gray-900 hover:bg-gray-800 h-8 text-sm">
                    Add to Cart
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Benefits Section */}
        <div className="px-4">
          <Card className="p-6 bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
            <h3 className="font-bold text-gray-900 mb-4">Why Shop With Us?</h3>
            <div className="space-y-3">
              {[
                { icon: '✅', title: '100% Authentic Products', desc: 'Genuine brands & quality guaranteed' },
                { icon: '🚚', title: 'Fast & Free Delivery', desc: 'Free shipping on orders above ₹999' },
                { icon: '💰', title: 'Best Price Guarantee', desc: 'Lowest prices in the market' },
                { icon: '🔒', title: 'Secure Payments', desc: 'Safe & encrypted transactions' }
              ].map((benefit, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">
                    {benefit.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm">{benefit.title}</h4>
                    <p className="text-xs text-gray-600">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}