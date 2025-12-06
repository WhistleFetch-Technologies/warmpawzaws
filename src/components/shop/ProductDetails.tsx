import React, { useState } from 'react';
import { Star, ShoppingCart, Heart, Truck, ShieldCheck, RefreshCw, Minus, Plus, Share2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { ShopLayout } from './ShopLayout';

// Mock Data for a single product (Simulating API fetch)
const MOCK_PRODUCT = {
  id: '1',
  title: 'Royal Canin Adult Golden Retriever Dog Food (3kg)',
  description: 'Royal Canin Golden Retriever Adult dry dog food is designed to meet the nutritional needs of purebred Golden Retrievers 15 months and older. Exclusive kibble shape designed specifically for a Golden Retriever’s straight muzzle and scissor bite to encourage chewing.',
  price: 2400,
  originalPrice: 2800,
  rating: 4.8,
  reviewCount: 450,
  images: [
    'https://images.unsplash.com/photo-1764249453874-46864677b10e?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=800&auto=format&fit=crop', // Placeholder for other angles
    'https://images.unsplash.com/photo-1591946614720-90a587da4a36?q=80&w=800&auto=format&fit=crop'
  ],
  variants: ['3kg', '10kg', '15kg'],
  details: [
    { label: 'Brand', value: 'Royal Canin' },
    { label: 'Life Stage', value: 'Adult' },
    { label: 'Breed', value: 'Golden Retriever' },
    { label: 'Flavor', value: 'Chicken' }
  ],
  seller: 'PetWorld India'
};

export function ProductDetails() {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState('3kg');

  // Calculate discount
  const discount = Math.round(((MOCK_PRODUCT.originalPrice - MOCK_PRODUCT.price) / MOCK_PRODUCT.originalPrice) * 100);

  return (
    <ShopLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 pb-12">
        {/* Left Column: Images */}
        <div className="flex flex-col gap-4">
          <div className="aspect-square bg-white rounded-lg border overflow-hidden relative">
            <ImageWithFallback 
              src={MOCK_PRODUCT.images[selectedImage]} 
              alt={MOCK_PRODUCT.title} 
              className="w-full h-full object-contain"
            />
            {discount > 0 && (
              <Badge className="absolute top-4 left-4 bg-red-600 text-lg px-3 py-1">
                {discount}% OFF
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="absolute top-4 right-4 rounded-full bg-white/80 hover:bg-white">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Thumbnails */}
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {MOCK_PRODUCT.images.map((img, idx) => (
              <button 
                key={idx}
                onClick={() => setSelectedImage(idx)}
                className={`w-20 h-20 shrink-0 border-2 rounded-md overflow-hidden ${selectedImage === idx ? 'border-primary' : 'border-transparent'}`}
              >
                <ImageWithFallback src={img} alt={`View ${idx}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Details */}
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {MOCK_PRODUCT.title}
            </h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 bg-green-700 text-white px-2 py-0.5 rounded text-sm font-bold">
                {MOCK_PRODUCT.rating} <Star className="h-3 w-3 fill-current" />
              </div>
              <span className="text-muted-foreground text-sm">{MOCK_PRODUCT.reviewCount} Ratings & Reviews</span>
            </div>
          </div>

          <Separator />

          {/* Price */}
          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold">₹{MOCK_PRODUCT.price.toLocaleString()}</span>
              <span className="text-xl text-muted-foreground line-through">₹{MOCK_PRODUCT.originalPrice.toLocaleString()}</span>
            </div>
            <p className="text-green-600 text-sm font-medium mt-1">Inclusive of all taxes</p>
          </div>

          {/* Variants */}
          <div>
            <label className="text-sm font-medium mb-2 block">Size</label>
            <div className="flex flex-wrap gap-3">
              {MOCK_PRODUCT.variants.map((variant) => (
                <Button
                  key={variant}
                  variant={selectedVariant === variant ? 'default' : 'outline'}
                  onClick={() => setSelectedVariant(variant)}
                  className="min-w-[80px]"
                >
                  {variant}
                </Button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="flex items-center border rounded-md w-fit">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 rounded-none"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 rounded-none"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button size="lg" className="flex-1 text-lg">
              <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
            </Button>
            
            <Button size="lg" variant="secondary" className="px-6">
              <Heart className="h-5 w-5" />
            </Button>
          </div>

          {/* Delivery & Trust */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 bg-gray-50 p-4 rounded-lg">
             <div className="flex items-start gap-3">
               <Truck className="h-5 w-5 text-primary mt-0.5" />
               <div className="text-sm">
                 <p className="font-semibold">Free Delivery</p>
                 <p className="text-muted-foreground">By Monday, 25 Jan</p>
               </div>
             </div>
             <div className="flex items-start gap-3">
               <RefreshCw className="h-5 w-5 text-primary mt-0.5" />
               <div className="text-sm">
                 <p className="font-semibold">7 Days Return</p>
                 <p className="text-muted-foreground">If damaged or expired</p>
               </div>
             </div>
             <div className="flex items-start gap-3">
               <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
               <div className="text-sm">
                 <p className="font-semibold">Quality Assured</p>
                 <p className="text-muted-foreground">Sold by {MOCK_PRODUCT.seller}</p>
               </div>
             </div>
          </div>

          {/* Tabs for Info */}
          <Tabs defaultValue="description" className="mt-8">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="specifications">Specifications</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>
            <TabsContent value="description" className="mt-4 text-muted-foreground leading-relaxed">
              {MOCK_PRODUCT.description}
            </TabsContent>
            <TabsContent value="specifications" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MOCK_PRODUCT.details.map((detail, idx) => (
                  <div key={idx} className="flex border-b pb-2">
                    <span className="w-1/3 text-muted-foreground font-medium">{detail.label}</span>
                    <span className="w-2/3">{detail.value}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="reviews" className="mt-4">
              <div className="text-center py-8 text-muted-foreground">
                No reviews yet. Be the first to review!
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ShopLayout>
  );
}
