import React from 'react';
import { Star, ShoppingCart, Heart } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter } from '../ui/card';
import { Badge } from '../ui/badge';
import { AspectRatio } from '../ui/aspect-ratio';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface ProductCardProps {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  image: string;
  category: string;
  outOfStock?: boolean;
  onAddToCart?: (id: string) => void;
  onToggleWishlist?: (id: string) => void;
}

export function ProductCard({
  id,
  title,
  price,
  originalPrice,
  rating,
  reviewCount,
  image,
  category,
  outOfStock = false,
  onAddToCart,
  onToggleWishlist
}: ProductCardProps) {
  // Calculate discount percentage if original price exists
  const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  return (
    <Card className="group overflow-hidden h-full flex flex-col hover:shadow-lg transition-shadow duration-200">
      <div className="relative">
        <AspectRatio ratio={1}>
          <div className="w-full h-full bg-gray-100 flex items-center justify-center overflow-hidden">
             <ImageWithFallback 
               src={image} 
               alt={title}
               className={`object-cover w-full h-full transition-transform duration-300 group-hover:scale-105 ${outOfStock ? 'opacity-50 grayscale' : ''}`}
             />
          </div>
        </AspectRatio>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {outOfStock ? (
            <Badge variant="destructive">Out of Stock</Badge>
          ) : discount > 0 ? (
            <Badge className="bg-red-600">{discount}% OFF</Badge>
          ) : null}
        </div>

        {/* Wishlist Button (Hidden until hover on desktop) */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full h-8 w-8"
          onClick={(e) => {
            e.preventDefault();
            onToggleWishlist?.(id);
          }}
        >
          <Heart className="h-4 w-4" />
        </Button>
      </div>

      <CardContent className="p-4 flex-1 flex flex-col gap-2">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{category}</div>
        <h3 className="font-medium text-sm md:text-base line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
        
        {/* Rating */}
        <div className="flex items-center gap-1">
          <div className="bg-green-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
            {rating} <Star className="h-2 w-2 fill-current" />
          </div>
          <span className="text-xs text-muted-foreground">({reviewCount.toLocaleString()})</span>
        </div>

        {/* Price */}
        <div className="mt-auto pt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold">₹{price.toLocaleString()}</span>
            {originalPrice && (
              <span className="text-xs text-muted-foreground line-through">
                ₹{originalPrice.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button 
          className="w-full" 
          disabled={outOfStock}
          onClick={(e) => {
            e.preventDefault();
            onAddToCart?.(id);
          }}
        >
          {outOfStock ? 'Unavailable' : (
            <>
              <ShoppingCart className="mr-2 h-4 w-4" /> Add to Cart
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
