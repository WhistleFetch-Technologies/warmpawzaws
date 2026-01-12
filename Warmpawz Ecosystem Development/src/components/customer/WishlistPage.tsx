/**
 * Wishlist Page - Saved products
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { EXPANDED_PRODUCTS } from '../../lib/mockDataExpanded';
import { toast } from 'sonner';

export function WishlistPage() {
  const navigate = useNavigate();
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWishlist();
  }, []);

  const loadWishlist = () => {
    setLoading(true);
    const saved = localStorage.getItem('warmpawz_wishlist');
    if (saved) {
      const wishlistIds = JSON.parse(saved);
      const items = EXPANDED_PRODUCTS.filter(p => wishlistIds.includes(p.id));
      setWishlistItems(items);
    }
    setLoading(false);
  };

  const removeFromWishlist = (productId: string) => {
    const saved = localStorage.getItem('warmpawz_wishlist');
    if (saved) {
      const wishlistIds = JSON.parse(saved);
      const updated = wishlistIds.filter((id: string) => id !== productId);
      localStorage.setItem('warmpawz_wishlist', JSON.stringify(updated));
      setWishlistItems(prev => prev.filter(p => p.id !== productId));
      toast.success('Removed from wishlist');
    }
  };

  const addToCart = (product: any) => {
    const cart = JSON.parse(localStorage.getItem('warmpawz_cart') || '[]');
    const existingItem = cart.find((item: any) => item.productId === product.id);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        quantity: 1
      });
    }
    
    localStorage.setItem('warmpawz_cart', JSON.stringify(cart));
    toast.success('Added to cart');
  };

  const moveAllToCart = () => {
    wishlistItems.forEach(product => {
      if (product.inStock) {
        addToCart(product);
      }
    });
    toast.success('All available items added to cart');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate('/shop')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Shop
            </Button>
            <h1 className="text-2xl font-bold">
              <Heart className="w-6 h-6 inline mr-2 fill-red-500 text-red-500" />
              My Wishlist
            </h1>
            <div className="w-32"></div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {wishlistItems.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h2 className="text-xl font-semibold mb-2">Your wishlist is empty</h2>
              <p className="text-gray-600 mb-6">
                Start adding products you love to your wishlist!
              </p>
              <Button
                onClick={() => navigate('/shop')}
                className="bg-gradient-to-r from-orange-500 to-pink-500"
              >
                Browse Products
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Header Actions */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-600">
                {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} in your wishlist
              </p>
              <Button
                onClick={moveAllToCart}
                variant="outline"
                className="gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Add All to Cart
              </Button>
            </div>

            {/* Wishlist Items */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {wishlistItems.map(product => (
                <Card
                  key={product.id}
                  className="overflow-hidden hover:shadow-lg transition-all group"
                >
                  <div className="relative">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-48 object-cover cursor-pointer"
                      onClick={() => navigate(`/shop/product/${product.id}`)}
                    />
                    {!product.inStock && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white font-semibold">Out of Stock</span>
                      </div>
                    )}
                    <button
                      onClick={() => removeFromWishlist(product.id)}
                      className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>

                  <CardContent className="p-4">
                    <div
                      className="cursor-pointer mb-3"
                      onClick={() => navigate(`/shop/product/${product.id}`)}
                    >
                      {product.brand && (
                        <p className="text-xs text-gray-500 uppercase mb-1">{product.brand}</p>
                      )}
                      <h3 className="font-semibold text-sm mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg font-bold">₹{product.price}</span>
                        {product.originalPrice && (
                          <span className="text-sm text-gray-500 line-through">
                            ₹{product.originalPrice}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={() => addToCart(product)}
                      disabled={!product.inStock}
                      className="w-full bg-gradient-to-r from-orange-500 to-pink-500 gap-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add to Cart
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
