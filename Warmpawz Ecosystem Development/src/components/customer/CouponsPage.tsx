/**
 * Coupons & Offers Page - Discovery page for all available coupons
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, Copy, Check, Calendar, TrendingUp, Gift, Percent } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { MOCK_COUPONS, MOCK_BUNDLE_DEALS } from '../../lib/mockDataExpanded';
import { toast } from 'sonner';

export function CouponsPage() {
  const navigate = useNavigate();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeCoupons, setActiveCoupons] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);

  useEffect(() => {
    setActiveCoupons(MOCK_COUPONS.filter(c => c.isActive));
    setBundles(MOCK_BUNDLE_DEALS.filter(b => b.isActive));
  }, []);

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Coupon code "${code}" copied!`);
    
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  const getCouponIcon = (type: string) => {
    switch (type) {
      case 'percentage':
        return <Percent className="w-5 h-5" />;
      case 'flat':
        return <TrendingUp className="w-5 h-5" />;
      case 'first_time':
        return <Gift className="w-5 h-5" />;
      default:
        return <Tag className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category?: string) => {
    const colors: Record<string, string> = {
      'Veterinary': 'border-teal-500 bg-teal-50',
      'Grooming': 'border-pink-500 bg-pink-50',
      'Training': 'border-purple-500 bg-purple-50',
      'Boarding': 'border-orange-500 bg-orange-50',
      'Walking': 'border-green-500 bg-green-50',
      'Daycare': 'border-yellow-500 bg-yellow-50',
      'Food': 'border-green-500 bg-green-50',
      'Toys': 'border-purple-500 bg-purple-50'
    };
    return category ? colors[category] || 'border-gray-300 bg-gray-50' : 'border-orange-500 bg-orange-50';
  };

  const serviceCoupons = activeCoupons.filter(c => c.applicableOn === 'services' || c.applicableOn === 'both');
  const productCoupons = activeCoupons.filter(c => c.applicableOn === 'products' || c.applicableOn === 'both');
  const categoryCoupons = activeCoupons.filter(c => c.type === 'category_specific');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center max-w-2xl mx-auto">
            <Tag className="w-16 h-16 mx-auto mb-4" />
            <h1 className="text-4xl font-bold mb-4">Coupons & Offers</h1>
            <p className="text-xl opacity-90">
              Save big on pet care! Discover exclusive deals and discounts
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-orange-500 to-pink-500 text-white">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold mb-1">{activeCoupons.length}</div>
              <div className="text-sm opacity-90">Active Coupons</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold mb-1">{bundles.length}</div>
              <div className="text-sm opacity-90">Bundle Deals</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-indigo-500 text-white">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold mb-1">50%</div>
              <div className="text-sm opacity-90">Max Discount</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold mb-1">New</div>
              <div className="text-sm opacity-90">This Week</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different coupon types */}
        <Tabs defaultValue="all" className="mb-8">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="all">All Offers</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="bundles">Bundles</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeCoupons.map(coupon => (
                <Card
                  key={coupon.id}
                  className={`border-2 ${getCategoryColor(coupon.category)} hover:shadow-lg transition-all`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getCouponIcon(coupon.type)}
                        <Badge className="bg-orange-500">
                          {coupon.type === 'percentage' ? `${coupon.value}% OFF` : `₹${coupon.value} OFF`}
                        </Badge>
                      </div>
                      {coupon.type === 'first_time' && (
                        <Badge className="bg-green-500">New User</Badge>
                      )}
                    </div>

                    <h3 className="font-bold text-lg mb-2">{coupon.description}</h3>
                    
                    {coupon.minOrderValue && (
                      <p className="text-sm text-gray-600 mb-2">
                        Min. order: ₹{coupon.minOrderValue}
                      </p>
                    )}

                    {coupon.maxDiscount && (
                      <p className="text-sm text-gray-600 mb-3">
                        Max. discount: ₹{coupon.maxDiscount}
                      </p>
                    )}

                    {coupon.category && (
                      <Badge variant="outline" className="mb-3">
                        {coupon.category} Only
                      </Badge>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 bg-white border-2 border-dashed border-orange-500 rounded-lg px-4 py-2 font-mono font-bold text-center text-orange-600">
                        {coupon.code}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => copyCouponCode(coupon.code)}
                        className="gap-2"
                      >
                        {copiedCode === coupon.code ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      Valid till {new Date(coupon.validUntil).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="services" className="mt-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {serviceCoupons.map(coupon => (
                <Card
                  key={coupon.id}
                  className={`border-2 ${getCategoryColor(coupon.category)} hover:shadow-lg transition-all`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <Badge className="bg-teal-500">Services</Badge>
                      <Badge className="bg-orange-500">
                        {coupon.type === 'percentage' ? `${coupon.value}% OFF` : `₹${coupon.value} OFF`}
                      </Badge>
                    </div>

                    <h3 className="font-bold text-lg mb-2">{coupon.description}</h3>
                    
                    {coupon.category && (
                      <Badge variant="outline" className="mb-3">
                        {coupon.category} Only
                      </Badge>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 bg-white border-2 border-dashed border-orange-500 rounded-lg px-4 py-2 font-mono font-bold text-center text-orange-600">
                        {coupon.code}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => copyCouponCode(coupon.code)}
                        className="gap-2"
                      >
                        {copiedCode === coupon.code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>

                    <Button
                      className="w-full bg-gradient-to-r from-orange-500 to-pink-500"
                      onClick={() => navigate('/services')}
                    >
                      Browse Services
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {productCoupons.map(coupon => (
                <Card
                  key={coupon.id}
                  className={`border-2 ${getCategoryColor(coupon.category)} hover:shadow-lg transition-all`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <Badge className="bg-blue-500">Products</Badge>
                      <Badge className="bg-orange-500">
                        {coupon.type === 'percentage' ? `${coupon.value}% OFF` : `₹${coupon.value} OFF`}
                      </Badge>
                    </div>

                    <h3 className="font-bold text-lg mb-2">{coupon.description}</h3>
                    
                    {coupon.category && (
                      <Badge variant="outline" className="mb-3">
                        {coupon.category} Products
                      </Badge>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 bg-white border-2 border-dashed border-orange-500 rounded-lg px-4 py-2 font-mono font-bold text-center text-orange-600">
                        {coupon.code}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => copyCouponCode(coupon.code)}
                        className="gap-2"
                      >
                        {copiedCode === coupon.code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>

                    <Button
                      className="w-full bg-gradient-to-r from-orange-500 to-pink-500"
                      onClick={() => navigate('/shop')}
                    >
                      Shop Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="bundles" className="mt-6">
            <div className="grid md:grid-cols-2 gap-6">
              {bundles.map(bundle => (
                <Card
                  key={bundle.id}
                  className="border-2 border-purple-500 bg-purple-50 hover:shadow-xl transition-all"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <Badge className="bg-purple-600 text-white">Bundle Deal</Badge>
                      <Badge className="bg-green-600 text-white">
                        Save {bundle.savingsPercentage}%
                      </Badge>
                    </div>

                    <h3 className="text-xl font-bold mb-2">{bundle.name}</h3>
                    <p className="text-gray-600 mb-4">{bundle.description}</p>

                    <div className="bg-white rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-600">Original Price:</span>
                        <span className="text-gray-500 line-through text-lg">
                          ₹{bundle.originalPrice}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-600">Bundle Price:</span>
                        <span className="text-2xl font-bold text-purple-600">
                          ₹{bundle.bundlePrice}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-green-600 font-semibold">
                        <span>You Save:</span>
                        <span>₹{bundle.savings}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                      <Calendar className="w-3 h-3" />
                      Valid till {new Date(bundle.validUntil).toLocaleDateString()}
                    </div>

                    <Button
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 h-12"
                      onClick={() => {
                        toast.success('Bundle added to cart!');
                        navigate('/shop/cart');
                      }}
                    >
                      Get This Bundle
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* CTA Banner */}
      <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Never Miss a Deal!
          </h2>
          <p className="text-xl opacity-90 mb-6">
            Subscribe to get exclusive offers and early access to sales
          </p>
          <div className="flex gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-lg text-gray-900"
            />
            <Button className="bg-white text-orange-600 hover:bg-gray-100">
              Subscribe
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
