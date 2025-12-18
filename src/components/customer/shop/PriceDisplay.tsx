import { cn } from "../../../lib/utils";

interface PriceDisplayProps {
  basePrice: number;
  salePrice?: number;
  currency?: string;
  showTax?: boolean;
  gstRate?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PriceDisplay({
  basePrice,
  salePrice,
  currency = '₹',
  showTax = false,
  gstRate = 18,
  className,
  size = 'md'
}: PriceDisplayProps) {
  const hasSale = salePrice !== undefined && salePrice < basePrice;
  const currentPrice = hasSale ? salePrice : basePrice;
  
  // Format numbers
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price);
  };

  const savingsAmount = hasSale ? basePrice - salePrice! : 0;
  const savingsPercent = hasSale ? Math.round((savingsAmount / basePrice) * 100) : 0;

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl'
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-baseline gap-2">
        {/* Current Price */}
        <span className={cn("font-bold text-gray-900", sizeClasses[size])}>
          {formatPrice(currentPrice)}
        </span>
        
        {/* Original Price */}
        {hasSale && (
          <span className={cn("text-gray-500 line-through decoration-gray-400", 
            size === 'lg' ? 'text-base' : 'text-xs'
          )}>
            {formatPrice(basePrice)}
          </span>
        )}
        
        {/* Discount Badge */}
        {hasSale && (
          <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
            {savingsPercent}% OFF
          </span>
        )}
      </div>
      
      {showTax && (
        <span className="text-[10px] text-gray-500 mt-0.5">
          Inclusive of all taxes
        </span>
      )}
    </div>
  );
}
