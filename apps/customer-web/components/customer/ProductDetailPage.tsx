"use client";

import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Star, 
  Heart, 
  Share2, 
  Plus, 
  Minus, 
  ShoppingCart, 
  Truck, 
  Shield, 
  RotateCcw, 
  CheckCircle2,
  Store,
  MapPin,
  Clock,
  Package,
  Info,
  ChevronRight,
  Tag,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/context/CartContext';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface ProductDetailPageProps {
  phone?: string;
  product?: any;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onReviewsClick?: () => void;
  onVendorClick?: () => void;
}

export function ProductDetailPage({ 
  phone, 
  product: initialProduct, 
  onBack, 
  onNavigate, 
  onReviewsClick, 
  onVendorClick 
}: ProductDetailPageProps) {
  const [product, setProduct] = useState<any>(initialProduct);
  const [loading, setLoading] = useState(!initialProduct);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const { addToCart, cart } = useCart();

  useEffect(() => {
    if (initialProduct?.id && !initialProduct?.fullDetails) {
      loadProductDetails();
    }
    if (initialProduct?.id) {
      loadRelatedProducts();
    }
  }, [initialProduct?.id]);

  const loadProductDetails = async () => {
    try {
      setLoading(true);
      const productId = initialProduct?.id || initialProduct?.productId;
      const response = await apiClient.get<any>(`/ecommerce/products/${productId}`);
      
      const productData = response.product || response;
      setProduct({
        ...initialProduct,
        ...productData,
        fullDetails: true
      });
    } catch (error) {
      console.error('Error loading product details:', error);
      toast.error('Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedProducts = async () => {
    try {
      const productId = initialProduct?.id || initialProduct?.productId;
      const category = initialProduct?.category || initialProduct?.category_name;
      
      if (category) {
        const response = await apiClient.get<any>(`/ecommerce/products?category=${category}&limit=4`);
        const products = response.products || response || [];
        // Filter out current product
        const filtered = products.filter((p: any) => 
          (p.id || p.product_id) !== productId
        ).slice(0, 4);
        setRelatedProducts(filtered);
      }
    } catch (error) {
      console.error('Error loading related products:', error);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;

    const cartItem = {
      id: product.id || product.productId,
      name: product.name || product.product_name,
      price: parseFloat(product.price || product.unit_price || 0),
      quantity: quantity,
      image: product.image || product.image_url || product.primary_image,
      vendorId: product.vendorId || product.vendor_id,
      vendorName: product.vendor?.name || product.vendor_name,
      ...product
    };

    addToCart(cartItem);
    toast.success(`${quantity} ${product.name || 'item'} added to cart`);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    onNavigate?.('cart');
  };

  const incrementQuantity = () => {
    const maxStock = product?.stock_quantity || product?.stock || 999;
    if (quantity < maxStock) {
      setQuantity(quantity + 1);
    } else {
      toast.info('Maximum stock available');
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const isInCart = cart.some(item => item.id === (product?.id || product?.productId));
  const inCartQuantity = cart.find(item => item.id === (product?.id || product?.productId))?.quantity || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FF8C42] border-t-transparent"></div>
      </div>
    );
  }

  if (!product) {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
            <h1 className="text-xl font-semibold">Product Not Found</h1>
          </div>
          <Card className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Product details not available</p>
            <Button onClick={onBack} className="mt-4">Go Back</Button>
          </Card>
        </div>
      </div>
    );
  }

  const productImages = product.images || 
    (product.image ? [product.image] : []) ||
    (product.image_url ? [product.image_url] : []) ||
    (product.primary_image ? [product.primary_image] : []) ||
    ['🐾'];

  const price = parseFloat(product.price || product.unit_price || 0);
  const originalPrice = product.original_price || product.mrp ? parseFloat(product.original_price || product.mrp) : null;
  const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const rating = product.rating || product.average_rating || 0;
  const reviewCount = product.reviews || product.review_count || 0;
  const inStock = product.in_stock !== false && (product.stock_quantity > 0 || product.stock !== 'Out of Stock');

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-md mx-auto bg-white">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold flex-1 text-center">Product Details</h1>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsWishlisted(!isWishlisted)}
                className="rounded-full"
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Image Gallery */}
        <div className="relative">
          <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
            {typeof productImages[selectedImageIndex] === 'string' && productImages[selectedImageIndex].startsWith('http') ? (
              <img 
                src={productImages[selectedImageIndex]} 
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-8xl">{productImages[selectedImageIndex] || '🐾'}</div>
            )}
          </div>
          
          {productImages.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex gap-2 justify-center px-4">
              {productImages.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${
                    selectedImageIndex === idx ? 'border-[#FF8C42]' : 'border-white'
                  }`}
                >
                  {typeof img === 'string' && img.startsWith('http') ? (
                    <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-2xl">{img || '🐾'}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {discount > 0 && (
            <Badge className="absolute top-4 left-4 bg-red-500 text-white">
              {discount}% OFF
            </Badge>
          )}
          
          {!inStock && (
            <Badge className="absolute top-4 right-4 bg-gray-500 text-white">
              Out of Stock
            </Badge>
          )}
        </div>

        {/* Product Info */}
        <div className="p-4 space-y-4">
          {/* Vendor Info */}
          {product.vendor && (
            <button
              onClick={onVendorClick}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#FF8C42] transition-colors"
            >
              <Store className="w-4 h-4" />
              <span className="font-medium">{product.vendor.name || product.vendor_name}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* Product Name */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{product.name || product.product_name}</h2>
            {product.category && (
              <Badge variant="outline" className="text-xs">
                {product.category || product.category_name}
              </Badge>
            )}
          </div>

          {/* Rating & Reviews */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span className="font-semibold text-gray-900">{rating.toFixed(1)}</span>
            </div>
            <button
              onClick={onReviewsClick}
              className="text-sm text-gray-600 hover:text-[#FF8C42] transition-colors"
            >
              ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
            </button>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Verified</span>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-[#FF8C42]">₹{price.toLocaleString()}</span>
            {originalPrice && originalPrice > price && (
              <>
                <span className="text-lg text-gray-400 line-through">₹{originalPrice.toLocaleString()}</span>
                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                  Save ₹{(originalPrice - price).toLocaleString()}
                </Badge>
              </>
            )}
          </div>

          {/* Stock Status */}
          <div className="flex items-center gap-2">
            {inStock ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-sm text-green-700 font-medium">In Stock</span>
                {product.stock_quantity && (
                  <span className="text-xs text-gray-500">({product.stock_quantity} available)</span>
                )}
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-sm text-red-700 font-medium">Out of Stock</span>
              </>
            )}
          </div>

          <Separator />

          {/* Quantity Selector */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Quantity</p>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={decrementQuantity}
                  disabled={quantity <= 1}
                  className="rounded-full"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-lg font-semibold w-12 text-center">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={incrementQuantity}
                  disabled={!inStock || quantity >= (product.stock_quantity || 999)}
                  className="rounded-full"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {isInCart && (
              <div className="text-right">
                <p className="text-xs text-gray-500">In Cart</p>
                <p className="text-sm font-semibold text-[#FF8C42]">{inCartQuantity} items</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleAddToCart}
              disabled={!inStock}
              className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {isInCart ? 'Update Cart' : 'Add to Cart'}
            </Button>
            <Button
              onClick={handleBuyNow}
              disabled={!inStock}
              className="flex-1 bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
            >
              Buy Now
            </Button>
          </div>

          {/* Delivery Info */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">Free Delivery</p>
                  <p className="text-xs text-gray-600">On orders above ₹499</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {product.vendor?.deliveryTime || '2-3 days'} delivery
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <RotateCcw className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">Easy Returns</p>
                  <p className="text-xs text-gray-600">7 days return policy</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">Secure Payment</p>
                  <p className="text-xs text-gray-600">100% secure transactions</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Description */}
          {product.description && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>
            </>
          )}

          {/* Specifications */}
          {(product.specifications || product.specs || product.weight || product.dimensions) && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Specifications</h3>
                <div className="space-y-2">
                  {product.weight && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Weight</span>
                      <span className="font-medium text-gray-900">{product.weight}</span>
                    </div>
                  )}
                  {product.dimensions && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Dimensions</span>
                      <span className="font-medium text-gray-900">{product.dimensions}</span>
                    </div>
                  )}
                  {product.brand && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Brand</span>
                      <span className="font-medium text-gray-900">{product.brand}</span>
                    </div>
                  )}
                  {product.sku && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">SKU</span>
                      <span className="font-medium text-gray-900">{product.sku}</span>
                    </div>
                  )}
                  {product.specifications && Object.entries(product.specifications).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="font-medium text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Reviews Section Link */}
          {reviewCount > 0 && (
            <>
              <Separator />
              <button
                onClick={onReviewsClick}
                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">Customer Reviews</p>
                    <p className="text-sm text-gray-600">
                      {rating.toFixed(1)} out of 5 ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </>
          )}

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">You May Also Like</h3>
                <div className="grid grid-cols-2 gap-3">
                  {relatedProducts.map((relatedProduct: any) => (
                    <Card
                      key={relatedProduct.id || relatedProduct.product_id}
                      onClick={() => onNavigate?.('product_detail', { product: relatedProduct })}
                      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                    >
                      <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-4xl">
                        {relatedProduct.image || relatedProduct.image_url || '🐾'}
                      </div>
                      <div className="p-3">
                        <h4 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-1">
                          {relatedProduct.name || relatedProduct.product_name}
                        </h4>
                        <p className="text-[#FF8C42] font-bold text-sm">
                          ₹{parseFloat(relatedProduct.price || relatedProduct.unit_price || 0).toLocaleString()}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
