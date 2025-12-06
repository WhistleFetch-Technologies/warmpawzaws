import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Truck, ShieldCheck, RefreshCw, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { ProductCard } from './ProductCard';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../ui/carousel";

// Mock Data (Simulating API Response)
const CATEGORIES = [
  { id: 'food', name: 'Food', image: 'figma:asset/b5587512c49079c8f2d108b98c68e54131f16550.png' }, // Using existing asset if available or fallback
  { id: 'toys', name: 'Toys', image: 'figma:asset/1e806484756e591173a13592075481293b1826d4.png' },
  { id: 'grooming', name: 'Grooming', image: 'figma:asset/295055ab0d2491f0194292787a44a41c08d23c7f.png' },
  { id: 'clothing', name: 'Clothing', image: 'figma:asset/f2dddff10fce8c5cc0468d3c13d16d6eeadcbdb7.png' },
  { id: 'health', name: 'Health', image: 'figma:asset/76faf8f617b56e6f079c5a7ead8f927f5a5fee32.png' },
  { id: 'bedding', name: 'Bedding', image: 'figma:asset/f990a4b952d3f4059e43dfc22221d97389a80787.png' },
];

const FEATURED_PRODUCTS = [
  {
    id: '1',
    title: 'Royal Canin Adult Dog Food - Maxi (3kg)',
    price: 1299,
    originalPrice: 1499,
    rating: 4.8,
    reviewCount: 1240,
    category: 'Food',
    image: 'https://images.unsplash.com/photo-1764249453874-46864677b10e?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: '2',
    title: 'Interactive Cat Laser Toy Automatic',
    price: 899,
    rating: 4.5,
    reviewCount: 85,
    category: 'Toys',
    image: 'https://images.unsplash.com/photo-1729008764855-9b5257318beb?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: '3',
    title: 'Orthopedic Memory Foam Dog Bed',
    price: 3499,
    originalPrice: 4999,
    rating: 4.9,
    reviewCount: 450,
    category: 'Bedding',
    image: 'https://images.unsplash.com/photo-1591946614720-90a587da4a36?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: '4',
    title: 'Natural Flea & Tick Shampoo (500ml)',
    price: 499,
    rating: 4.2,
    reviewCount: 210,
    category: 'Grooming',
    image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=400&auto=format&fit=crop',
  }
];

export function ShopHome() {
  return (
    <div className="flex flex-col gap-8 pb-8">
      {/* Hero Carousel */}
      <section className="w-full">
        <Carousel className="w-full max-w-[100vw] md:max-w-full overflow-hidden rounded-lg">
           <CarouselContent>
             <CarouselItem>
               <div className="relative w-full aspect-[21/9] md:aspect-[3/1] bg-gray-100 rounded-lg overflow-hidden">
                 <ImageWithFallback 
                   src="https://images.unsplash.com/photo-1679314592144-e309b7f5132e?q=80&w=1200&auto=format&fit=crop" 
                   alt="Super Sale" 
                   className="w-full h-full object-cover"
                 />
                 <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-center p-6 md:p-16">
                   <div className="text-white max-w-lg">
                     <h2 className="text-3xl md:text-5xl font-bold mb-4">The Great Pet Sale is Live!</h2>
                     <p className="text-lg md:text-xl mb-6 opacity-90">Up to 60% OFF on premium food brands and accessories.</p>
                     <Button size="lg" variant="default" className="font-semibold">Shop Now</Button>
                   </div>
                 </div>
               </div>
             </CarouselItem>
             {/* Add more slides here */}
           </CarouselContent>
        </Carousel>
      </section>

      {/* Trust Badges (Flipkart Style) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white dark:bg-neutral-900 rounded-lg border shadow-sm">
        <div className="flex items-center gap-3 justify-center">
          <div className="p-2 bg-primary/10 rounded-full text-primary"><Truck className="h-5 w-5" /></div>
          <div className="text-sm"><div className="font-bold">Free Delivery</div><div className="text-muted-foreground text-xs">On orders above ₹499</div></div>
        </div>
        <div className="flex items-center gap-3 justify-center">
          <div className="p-2 bg-primary/10 rounded-full text-primary"><ShieldCheck className="h-5 w-5" /></div>
          <div className="text-sm"><div className="font-bold">Secure Payment</div><div className="text-muted-foreground text-xs">100% secure transactions</div></div>
        </div>
        <div className="flex items-center gap-3 justify-center">
          <div className="p-2 bg-primary/10 rounded-full text-primary"><RefreshCw className="h-5 w-5" /></div>
          <div className="text-sm"><div className="font-bold">Easy Returns</div><div className="text-muted-foreground text-xs">7-day replacement policy</div></div>
        </div>
        <div className="flex items-center gap-3 justify-center">
          <div className="p-2 bg-primary/10 rounded-full text-primary"><Clock className="h-5 w-5" /></div>
          <div className="text-sm"><div className="font-bold">24/7 Support</div><div className="text-muted-foreground text-xs">Help center available</div></div>
        </div>
      </section>

      {/* Featured Categories */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Shop by Category</h2>
          <Link to="/shop/categories" className="text-primary hover:underline flex items-center gap-1 text-sm font-medium">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {CATEGORIES.map((cat) => (
            <Link key={cat.id} to={`/shop?category=${cat.id}`} className="group">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-full aspect-square rounded-full overflow-hidden border-2 border-transparent group-hover:border-primary transition-colors p-1">
                  <div className="w-full h-full rounded-full overflow-hidden bg-gray-100">
                    <ImageWithFallback src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                  </div>
                </div>
                <span className="font-medium text-sm group-hover:text-primary transition-colors">{cat.name}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Trending Now</h2>
          <Link to="/shop" className="text-primary hover:underline flex items-center gap-1 text-sm font-medium">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {FEATURED_PRODUCTS.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      </section>

       {/* Sponsored/Ad Banner */}
       <section className="w-full h-48 rounded-lg overflow-hidden relative bg-gray-900">
         <ImageWithFallback 
           src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=1200&auto=format&fit=crop" 
           alt="Ad Banner" 
           className="w-full h-full object-cover opacity-60"
         />
         <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-4">
           <h3 className="text-2xl md:text-3xl font-bold mb-2">Join Warmpawz Gold</h3>
           <p className="mb-4 max-w-md">Get extra 5% off on every order + Free Delivery + Priority Support.</p>
           <Button variant="secondary">Explore Membership</Button>
         </div>
       </section>
    </div>
  );
}
