import { ShoppingCart, Eye, Star } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { PriceDisplay } from './PriceDisplay';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { cn } from "../../../lib/utils";

export interface Product {
  id: string;
  name: string;
  vendorName: string;
  basePrice: number;
  salePrice?: number;
  images: string[];
  averageRating?: number;
  reviewCount?: number;
  stockQuantity: number;
  category: string;
  tags?: string[];
  isSponsored?: boolean;
  isFlashSale?: boolean;
}

interface ProductCardProps {
  product: Product;
  onAddToCart?: (productId: string, e?: React.MouseEvent) => void;
  onQuickView?: (productId: string, e?: React.MouseEvent) => void;
  className?: string;
}

export function ProductCard({ 
  product, 
  onAddToCart, 
  onQuickView,
  className 
}: ProductCardProps) {
  const { 
    name, 
    vendorName, 
    basePrice, 
    salePrice, 
    images, 
    averageRating = 0, 
    reviewCount = 0,
    stockQuantity,
    isSponsored,
    isFlashSale
  } = product;

  const isOutOfStock = stockQuantity === 0;
  const isLowStock = stockQuantity > 0 && stockQuantity < 10;

  return (
    <Card className={cn("group relative flex flex-col h-full overflow-hidden hover:shadow-lg transition-shadow duration-300 bg-white border-gray-100", className)}>
      
      {/* Badges */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {isSponsored && (
          <Badge variant="secondary" className="bg-white/90 text-xs text-gray-500 backdrop-blur-sm">
            Sponsored
          </Badge>
        )}
        {isFlashSale && (
          <Badge className="bg-red-500 text-white text-xs animate-pulse">
            ⚡ Flash Sale
          </Badge>
        )}
        {isOutOfStock && (
          <Badge className="bg-gray-500 text-white text-xs">
            Out of Stock
          </Badge>
        )}
      </div>

      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-50 group-hover:opacity-95 transition-opacity">
        <ImageWithFallback
          src={images?.[0] || '/placeholder-product.png'}
          alt={name}
          className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Overlay Actions (Desktop) */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center gap-2">
          <Button 
            size="icon" 
            className="bg-white text-gray-900 hover:bg-gray-100 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onQuickView?.(product.id, e);
            }}
            title="Quick View"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button 
            size="icon" 
            className="bg-indigo-600 text-white hover:bg-indigo-700 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart?.(product.id, e);
            }}
            disabled={isOutOfStock}
            title="Add to Cart"
          >
            <ShoppingCart className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3">
        {/* Vendor */}
        <p className="text-xs text-gray-500 mb-1 truncate">{vendorName}</p>
        
        {/* Title */}
        <h3 className="font-medium text-gray-900 text-sm leading-tight line-clamp-2 mb-2 flex-1 group-hover:text-indigo-600 transition-colors">
          {name}
        </h3>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-2">
          <div className="flex text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <Star 
                key={i} 
                className={cn("w-3 h-3", i < Math.round(averageRating) ? "fill-current" : "text-gray-300")} 
              />
            ))}
          </div>
          <span className="text-xs text-gray-400">({reviewCount})</span>
        </div>

        {/* Price & Action */}
        <div className="mt-auto flex items-end justify-between">
          <PriceDisplay 
            basePrice={basePrice} 
            salePrice={salePrice} 
            size="md"
          />
          
          {/* Mobile Add Button */}
          <Button 
            size="icon" 
            variant="ghost"
            className="md:hidden h-8 w-8 text-indigo-600 bg-indigo-50 rounded-full pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart?.(product.id, e);
            }}
            disabled={isOutOfStock}
          >
            <ShoppingCart className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Low Stock Warning */}
        {isLowStock && !isOutOfStock && (
          <p className="text-[10px] text-red-500 mt-1 font-medium">
            Only {stockQuantity} left!
          </p>
        )}
      </div>
    </Card>
  );
}
