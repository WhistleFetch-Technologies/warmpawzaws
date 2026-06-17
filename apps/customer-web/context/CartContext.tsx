"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import {
  CART_UPDATED_EVENT,
  WARMPAWZ_CART_KEY,
  readWarmpawzCartLines,
  type WarmpawzCartLine,
  type WarmpawzCartProductSnapshot,
} from "@/lib/warmpawz-cart-storage";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  /** MRP / compare-at when a discount exists */
  originalPrice?: number;
  quantity: number;
  image?: string;
  vendorId?: string;
  vendorName?: string;
  categoryId?: string;
  category?: string;
  selectedVariations?: Record<string, string>;
  /** Round-trip storage row for `/shop` localStorage format */
  warmpawzLine?: WarmpawzCartLine;
  [key: string]: unknown;
}

interface CartContextType {
  cart: CartItem[];
  itemCount: number;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function lineToCartItem(line: WarmpawzCartLine): CartItem {
  const p = line.product as Record<string, unknown> | undefined;
  const id = String(line.product_id || (p?.id as string) || "");
  const name = String(p?.name ?? "");
  const price = Number(p?.price) || 0;
  const images = p?.images as string[] | undefined;
  const imageFromList = Array.isArray(images) && images[0] ? String(images[0]) : undefined;
  const imageEmoji = p?.emoji != null ? String(p.emoji) : undefined;
  const categoryId =
    p?.category_id != null ? String(p.category_id) : undefined;
  const originalRaw = p?.original_price;
  const originalPrice =
    originalRaw != null && Number(originalRaw) > 0 ? Number(originalRaw) : undefined;
  return {
    id,
    name,
    price,
    originalPrice,
    quantity: Math.max(1, Number(line.quantity) || 1),
    image: imageFromList || imageEmoji,
    vendorId: p?.vendor_id != null ? String(p.vendor_id) : undefined,
    vendorName: p?.vendor_name != null ? String(p.vendor_name) : undefined,
    categoryId,
    category: categoryId,
    selectedVariations: line.selected_variations,
    productSkuId: line.product_sku_id,
    warmpawzLine: line,
  };
}

function cartItemsToLines(items: CartItem[]): WarmpawzCartLine[] {
  return items.map((item) => {
    const w = item.warmpawzLine;
    if (w) {
      return {
        ...w,
        product_id: String(w.product_id || item.id),
        quantity: item.quantity,
      };
    }
    const snap = {
      id: item.id,
      name: item.name,
      price: item.price,
      stock: 99,
      ...(item.vendorName ? { vendor_name: item.vendorName } : {}),
      ...(item.image ? { images: [item.image] } : {}),
      ...(item.vendorId ? { vendor_id: item.vendorId } : {}),
      ...(item.categoryId ? { category_id: String(item.categoryId) } : {}),
    };
    return {
      product_id: item.id,
      quantity: item.quantity,
      product: snap as WarmpawzCartProductSnapshot,
      product_sku_id: item.productSkuId as string | undefined,
      selected_variations: item.selectedVariations,
    };
  });
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const skipNextPersist = useRef(true);

  const reloadFromStorage = useCallback(() => {
    setCart(readWarmpawzCartLines().map(lineToCartItem));
  }, []);

  useEffect(() => {
    reloadFromStorage();
  }, [reloadFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onExternal = () => reloadFromStorage();
    window.addEventListener(CART_UPDATED_EVENT, onExternal);
    window.addEventListener("storage", onExternal);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, onExternal);
      window.removeEventListener("storage", onExternal);
    };
  }, [reloadFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(
        WARMPAWZ_CART_KEY,
        JSON.stringify(cartItemsToLines(cart))
      );
    } catch {
      /* ignore quota / private mode */
    }
  }, [cart]);

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + item.quantity, warmpawzLine: i.warmpawzLine ?? item.warmpawzLine }
            : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const getTotal = useCallback(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        itemCount,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
