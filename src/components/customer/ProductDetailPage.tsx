import { useState } from 'react';
import { 
  ArrowLeft, 
  Heart, 
  Share2, 
  Star, 
  ShoppingCart, 
  Truck, 
  Shield, 
  ChevronRight,
  Check,
  AlertCircle,
  Plus,
  Minus,
  Package,
  Clock
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { useCart } from '../../context/CartContext';
import { toast } from 'sonner';

interface ProductDetailPageProps {
  product: any;
  onBack: () => void;
  onReviewsClick?: () => void;
  onVendorClick?: () => void;
}

export function ProductDetailPage({ product, onBack, onReviewsClick, onVendorClick }: ProductDetailPageProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const { addToCart } = useCart();

  // Mock images - in real app these would come from product data
  const images = product.images && product.images.length > 0 
    ? product.images 
    : (product.image ? [product.image] : [
      'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&q=80&w=800'
    ]);

  const handleAddToCart = () => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: quantity,
      image: images[0], // Use the first image
      prescriptionRequired: product.prescriptionRequired,
      vendorId: product.vendorId,
      vendorName: product.vendorName,
      category: product.category,
      size: product.size // Pass size to cart if needed
    });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    // In real app, navigate to checkout
    toast.success('Added to cart! Proceeding to checkout...');
  };

  const incrementQuantity = () => setQuantity(prev => Math.min(prev + 1, 10));
  const decrementQuantity = () => setQuantity(prev => Math.max(prev - 1, 1));

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto relative">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setIsFavorite(!isFavorite);
                toast.success(isFavorite ? 'Removed from wishlist' : 'Added to wishlist');
              }}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
            </button>
            <button 
              onClick={() => toast.success('Share link copied!')}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <Share2 className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>
      </div>

      <div className="pb-32">
        {/* Image Gallery */}
        <div className="relative">
          <div className="aspect-square bg-gray-50">
            <img 
              src={images[selectedImage]} 
              alt={product.name}
              className="w-full h-full object-contain"
            />
          </div>
          
          {/* Badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            {product.discount && (
              <Badge className="bg-red-500 text-white">
                {product.discount} OFF
              </Badge>
            )}
            {product.badge && (
              <Badge className="bg-blue-500 text-white">
                {product.badge}
              </Badge>
            )}
          </div>

          {/* Image Thumbnails */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${
                    selectedImage === idx ? 'border-[#FF8C42]' : 'border-gray-200'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="px-4 py-6">
          {/* Title and Rating */}
          <div className="mb-4">
            {product.header && (
              <p className="text-[#FF8C42] font-medium text-sm mb-1">{product.header}</p>
            )}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{product.rating}</span>
                <span className="text-gray-500">({product.reviews || 0} reviews)</span>
              </div>
              <button 
                onClick={onReviewsClick}
                className="text-[#FF8C42] text-sm font-medium hover:underline"
              >
                See all reviews
              </button>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-3xl font-bold text-gray-900">₹{product.price}</span>
            {product.originalPrice && (
              <>
                <span className="text-lg text-gray-400 line-through">₹{product.originalPrice}</span>
                <Badge className="bg-green-100 text-green-700">
                  Save ₹{product.originalPrice - product.price}
                </Badge>
              </>
            )}
          </div>

          {/* Stock Status */}
          <div className="mb-6">
            {product.inStock !== false ? (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="w-5 h-5" />
                <span className="font-medium">In Stock</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Out of Stock</span>
              </div>
            )}
          </div>

          <Separator className="my-6" />

          {/* Description */}
          <div className="mb-6">
            <h2 className="font-semibold text-gray-900 mb-3">Product Description</h2>
            <p className="text-gray-600 leading-relaxed">
              {product.description || 'Premium quality pet product designed for your furry friend\'s comfort and wellbeing.'}
            </p>
          </div>

          {/* Product Specifications */}
          {(product.size || product.weight || (product.dimensions && (product.dimensions.length || product.dimensions.width || product.dimensions.height))) && (
            <div className="mb-6">
              <h2 className="font-semibold text-gray-900 mb-3">Specifications</h2>
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                {product.size && (
                  <div>
                    <p className="text-sm text-gray-500">Size/Variant</p>
                    <p className="font-medium text-gray-900">{product.size}</p>
                  </div>
                )}
                {product.weight && (
                  <div>
                    <p className="text-sm text-gray-500">Weight</p>
                    <p className="font-medium text-gray-900">{product.weight} kg</p>
                  </div>
                )}
                {product.dimensions && (product.dimensions.length || product.dimensions.width || product.dimensions.height) && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Dimensions (L x W x H)</p>
                    <p className="font-medium text-gray-900">
                      {product.dimensions.length || '-'} x {product.dimensions.width || '-'} x {product.dimensions.height || '-'} cm
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Key Features */}
          <div className="mb-6">
            <h2 className="font-semibold text-gray-900 mb-3">Key Features</h2>
            <div className="space-y-2">
              {(product.features || [
                'High quality materials',
                'Safe for all pets',
                'Easy to use',
                'Durable and long-lasting'
              ]).map((feature: string, idx: number) => (
                <div key={idx} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator className="my-6" />

          {/* Delivery Info */}
          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl">
              <Truck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Free Delivery</p>
                <p className="text-sm text-gray-600">On orders above ₹999</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl">
              <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">100% Genuine Products</p>
                <p className="text-sm text-gray-600">Verified and authenticated</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-xl">
              <Package className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Easy Returns</p>
                <p className="text-sm text-gray-600">7 days return policy</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-xl">
              <Clock className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Fast Shipping</p>
                <p className="text-sm text-gray-600">Delivered in 2-3 business days</p>
              </div>
            </div>
          </div>

          {/* Prescription Required */}
          {product.prescriptionRequired && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900 mb-1">Prescription Required</p>
                  <p className="text-sm text-gray-600">
                    You'll need to upload a valid prescription during checkout
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Vendor Info */}
          {product.vendorName && (
            <div className="mb-6">
              <Separator className="mb-4" />
              <h2 className="font-semibold text-gray-900 mb-3">Sold By</h2>
              <button 
                onClick={onVendorClick}
                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#FF8C42] rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">🏪</span>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{product.vendorName}</p>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm text-gray-600">4.8 (2.5k ratings)</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          {/* Quantity Selector */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button 
              onClick={decrementQuantity}
              className="p-2 hover:bg-white rounded-md transition-colors disabled:opacity-50"
              disabled={quantity <= 1}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-semibold">{quantity}</span>
            <button 
              onClick={incrementQuantity}
              className="p-2 hover:bg-white rounded-md transition-colors disabled:opacity-50"
              disabled={quantity >= 10}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add to Cart Button */}
          <Button
            onClick={handleAddToCart}
            disabled={product.inStock === false}
            className="flex-1 bg-white border-2 border-[#FF8C42] text-[#FF8C42] hover:bg-[#FF8C42] hover:text-white h-12"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Add to Cart
          </Button>

          {/* Buy Now Button */}
          <Button
            onClick={handleBuyNow}
            disabled={product.inStock === false}
            className="flex-1 bg-[#FF8C42] hover:bg-[#FF7028] text-white h-12"
          >
            Buy Now
          </Button>
        </div>
      </div>
    </div>
  );
}