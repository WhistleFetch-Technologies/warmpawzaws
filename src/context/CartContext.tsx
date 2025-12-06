import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner@2.0.3';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  prescriptionRequired?: boolean;
  vendorId?: string;
  vendorName?: string;
  vendorRating?: number;
  vendorReviews?: number;
  category?: string;
  originalPrice?: number;
  discount?: number;
  deliveryTime?: string;
  inStock?: boolean;
  freeDelivery?: boolean;
  returnable?: boolean;
  returnDays?: number;
  warranty?: string;
  size?: string;
  header?: string;
}

export interface SavedItem extends CartItem {
  savedDate: string;
}

interface CartContextType {
  items: CartItem[];
  savedItems: SavedItem[];
  addToCart: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  saveForLater: (itemId: string) => void;
  moveToCart: (itemId: string) => void;
  removeSavedItem: (itemId: string) => void;
  cartTotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('warmpawz_cart');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to parse cart from storage');
      }
    }
    
    const savedForLater = localStorage.getItem('warmpawz_saved');
    if (savedForLater) {
      try {
        setSavedItems(JSON.parse(savedForLater));
      } catch (e) {
        console.error('Failed to parse saved items from storage');
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('warmpawz_cart', JSON.stringify(items));
  }, [items]);

  // Save saved items to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('warmpawz_saved', JSON.stringify(savedItems));
  }, [savedItems]);

  const addToCart = (newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setItems(prev => {
      const existingItem = prev.find(item => item.id === newItem.id);
      if (existingItem) {
        toast.success(`Updated quantity for ${newItem.name}`);
        return prev.map(item => 
          item.id === newItem.id 
            ? { ...item, quantity: item.quantity + (newItem.quantity || 1) }
            : item
        );
      }
      toast.success(`Added ${newItem.name} to cart`);
      return [...prev, { ...newItem, quantity: newItem.quantity || 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
    toast.info('Item removed from cart');
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, quantity } : item
    ));
  };

  const clearCart = () => {
    setItems([]);
    localStorage.removeItem('warmpawz_cart');
  };

  const saveForLater = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setSavedItems(prev => [...prev, { ...item, savedDate: new Date().toISOString() }]);
      removeFromCart(itemId);
      toast.success('Item saved for later');
    }
  };

  const moveToCart = (itemId: string) => {
    const item = savedItems.find(i => i.id === itemId);
    if (item) {
      const { savedDate, ...cartItem } = item;
      addToCart(cartItem);
      setSavedItems(prev => prev.filter(i => i.id !== itemId));
    }
  };

  const removeSavedItem = (itemId: string) => {
    setSavedItems(prev => prev.filter(i => i.id !== itemId));
    toast.info('Saved item removed');
  };

  const cartTotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      items,
      savedItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      saveForLater,
      moveToCart,
      removeSavedItem,
      cartTotal,
      itemCount
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
