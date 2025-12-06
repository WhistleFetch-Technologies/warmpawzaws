import React, { useState } from 'react';
import { ShoppingCart, X, Plus, Minus, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "../ui/sheet";
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../ui/badge';

// Mock Data for Cart
const MOCK_CART_ITEMS = [
  {
    id: '1',
    title: 'Royal Canin Adult Golden Retriever Dog Food (3kg)',
    price: 2400,
    originalPrice: 2800,
    quantity: 1,
    image: 'https://images.unsplash.com/photo-1764249453874-46864677b10e?q=80&w=200&auto=format&fit=crop',
    variant: '3kg'
  },
  {
    id: '2',
    title: 'Interactive Cat Laser Toy Automatic',
    price: 899,
    originalPrice: 0,
    quantity: 2,
    image: 'https://images.unsplash.com/photo-1729008764855-9b5257318beb?q=80&w=200&auto=format&fit=crop',
    variant: 'Red'
  }
];

const SUGGESTED_ITEMS = [
  { id: '3', title: 'Dog Chew Bone', price: 199, image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=100&auto=format&fit=crop' },
  { id: '4', title: 'Pet Wipes', price: 299, image: 'https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?q=80&w=100&auto=format&fit=crop' }
];

export function CartSheet({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const [items, setItems] = useState(MOCK_CART_ITEMS);

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const savings = items.reduce((sum, item) => sum + ((item.originalPrice || item.price) - item.price) * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const updateQuantity = (id: string, delta: number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon" className="relative">
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full p-0 text-xs"
              >
                {itemCount}
              </Badge>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b bg-white z-10">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> My Cart ({itemCount})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
              <ShoppingCart className="h-10 w-10 text-gray-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Your cart is empty</h3>
              <p className="text-sm text-muted-foreground">Looks like you haven't added anything yet.</p>
            </div>
            <SheetClose asChild>
              <Button onClick={() => navigate('/shop')}>Start Shopping</Button>
            </SheetClose>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-6">
              <div className="py-4 space-y-6">
                {/* Cart Items */}
                <div className="space-y-6">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="w-20 h-20 rounded-md border bg-gray-50 overflow-hidden shrink-0 relative">
                        <ImageWithFallback 
                          src={item.image} 
                          alt={item.title} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-sm font-medium line-clamp-2">{item.title}</h4>
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="text-muted-foreground hover:text-red-600 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Variant: {item.variant}</p>
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">₹{item.price.toLocaleString()}</span>
                            {item.originalPrice > item.price && (
                              <span className="text-xs text-muted-foreground line-through">
                                ₹{item.originalPrice.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center border rounded-md h-7">
                            <button 
                              onClick={() => updateQuantity(item.id, -1)}
                              className="px-2 h-full hover:bg-gray-100 border-r flex items-center"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-medium">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, 1)}
                              className="px-2 h-full hover:bg-gray-100 border-l flex items-center"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                {/* Suggested Add-ons (Upsell) */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Frequently bought together</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {SUGGESTED_ITEMS.map(item => (
                      <div key={item.id} className="border rounded-lg p-2 flex flex-col gap-2">
                        <div className="aspect-square bg-gray-50 rounded-md overflow-hidden">
                          <ImageWithFallback src={item.image} alt={item.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-medium line-clamp-1">{item.title}</div>
                          <div className="text-xs font-bold">₹{item.price}</div>
                          <Button variant="outline" size="sm" className="w-full h-6 text-[10px]">Add</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Footer Actions */}
            <div className="border-t p-6 space-y-4 bg-gray-50/50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{subtotal.toLocaleString()}</span>
                </div>
                {savings > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Total Savings</span>
                    <span>-₹{savings.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>₹{subtotal.toLocaleString()}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SheetClose asChild>
                  <Button variant="outline" className="w-full" onClick={() => navigate('/shop/cart')}>
                    View Bag
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button className="w-full" onClick={() => navigate('/shop/checkout')}>
                    Checkout
                  </Button>
                </SheetClose>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
