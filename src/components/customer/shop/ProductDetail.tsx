import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Share2, Minus, Plus, ShoppingCart, Star, Check, Truck } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { PriceDisplay } from './PriceDisplay';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { cn } from '../../../lib/utils';

interface ProductDetailProps {
  productId: string;
  onBack: () => void;
  customerId: string;
}

export function ProductDetail({ productId, onBack, customerId }: ProductDetailProps) {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [pincode, setPincode] = useState('');
  const [deliveryDate, setDeliveryDate] = useState<string | null>(null);

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/product/${productId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setProduct(data.product);
        if (data.product.variants && data.product.variants.length > 0) {
          setSelectedVariant(data.product.variants[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
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
            productId: product.id,
            quantity,
            variantId: selectedVariant?.id
          })
        }
      );

      if (res.ok) {
        toast.success('Added to cart');
        // Optionally trigger cart refresh
      } else {
        throw new Error('Failed to add to cart');
      }
    } catch (error) {
      toast.error('Failed to add to cart');
    }
  };

  const checkDelivery = () => {
    if (pincode.length === 6) {
      // Simulate API call
      setTimeout(() => {
        const date = new Date();
        date.setDate(date.getDate() + 3);
        setDeliveryDate(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
        toast.success('Delivery available!');
      }, 500);
    } else {
      toast.error('Please enter a valid 6-digit pincode');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!product) return null;

  const currentPrice = selectedVariant ? (selectedVariant.price || product.basePrice) : product.basePrice;
  const stock = selectedVariant ? selectedVariant.stock : product.stockQuantity;

  return (
    <div className="min-h-screen bg-white pb-24 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon">
            <Share2 className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Heart className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="w-full bg-gray-50 aspect-square relative">
        <ImageWithFallback
          src={product.images?.[selectedImage] || '/placeholder-product.png'}
          alt={product.name}
          className="w-full h-full object-contain mix-blend-multiply"
        />
        {product.images?.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto">
            {product.images.map((img: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setSelectedImage(idx)}
                className={cn(
                  "w-12 h-12 rounded-lg border-2 overflow-hidden bg-white",
                  selectedImage === idx ? "border-indigo-600" : "border-transparent"
                )}
              >
                <ImageWithFallback src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* Title & Rating */}
        <div className="space-y-2">
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="text-sm text-indigo-600 font-medium mb-1">{product.brand || product.vendorName}</p>
              <h1 className="text-xl font-semibold text-gray-900 leading-tight">{product.name}</h1>
            </div>
            <div className="flex flex-col items-end bg-green-50 px-2 py-1 rounded">
              <div className="flex items-center gap-1">
                <span className="font-bold text-green-700">{product.averageRating || 4.5}</span>
                <Star className="w-3 h-3 fill-green-700 text-green-700" />
              </div>
              <span className="text-[10px] text-green-600">{product.reviewCount || 12} reviews</span>
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
           <PriceDisplay 
             basePrice={product.basePrice} 
             salePrice={product.salePrice} 
             size="lg"
             showTax
           />
           {stock < 10 && stock > 0 && (
             <Badge variant="destructive" className="animate-pulse">Only {stock} left!</Badge>
           )}
           {stock === 0 && <Badge variant="secondary">Out of Stock</Badge>}
        </div>

        {/* Variants */}
        {product.hasVariants && product.variants && (
          <div className="space-y-3">
            <h3 className="font-medium text-sm">Select Option</h3>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((variant: any) => (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariant(variant)}
                  className={cn(
                    "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                    selectedVariant?.id === variant.id
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >
                  {variant.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Delivery */}
        <div className="space-y-3 pt-2 border-t">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Truck className="w-4 h-4" /> Delivery Check
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={6}
              placeholder="Enter Pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
              className="flex-1 bg-gray-50 border-none rounded-lg px-4 text-sm focus:ring-1 focus:ring-indigo-500"
            />
            <Button onClick={checkDelivery} variant="outline" size="sm" className="text-indigo-600 border-indigo-200">
              Check
            </Button>
          </div>
          {deliveryDate && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> Delivery by {deliveryDate}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-3 pt-2 border-t">
          <h3 className="font-medium text-sm">Description</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {product.description}
          </p>
          {product.shortDescription && (
             <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-1">
               {product.shortDescription.split('\n').map((line: string, i: number) => (
                 <li key={i}>{line.replace(/^- /, '')}</li>
               ))}
             </ul>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] max-w-md mx-auto z-50">
        <div className="flex gap-3">
          <div className="flex items-center border rounded-lg px-2">
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="p-2 hover:text-indigo-600 disabled:opacity-50"
              disabled={quantity <= 1}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-medium text-sm">{quantity}</span>
            <button 
              onClick={() => setQuantity(Math.min(stock, quantity + 1))}
              className="p-2 hover:text-indigo-600 disabled:opacity-50"
              disabled={quantity >= stock}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <Button 
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleAddToCart}
            disabled={stock === 0}
          >
            {stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </Button>
        </div>
      </div>
    </div>
  );
}
