import { Hono } from "npm:hono";
import { getCartsRepository } from "../../lib/repositories/carts.ts";
import { getWishlistsRepository } from "../../lib/repositories/wishlists.ts";
import { getPaymentCardsRepository } from "../../lib/repositories/payment-cards.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getDbClient } from "../../lib/db.ts";

const app = new Hono();
const supabase = getDbClient();

// ============================================
// CART MANAGEMENT
// ✅ MIGRATED TO SQL: Uses CartsRepository
// ============================================

// Get customer cart
app.get("/customer/:customerId/cart", async (c) => {
  try {
    const { customerId } = c.req.param();
    
    // ✅ SQL: Resolve customer ID
    const customersRepo = getCustomersRepository();
    let customer = await customersRepo.findById(customerId);
    if (!customer) {
      customer = await customersRepo.findByPhone(customerId);
    }
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Get cart
    const cartsRepo = getCartsRepository();
    const cart = await cartsRepo.findOrCreate(customer.id);
    
    // Get full details for each cart item
    const itemsWithDetails = await Promise.all(
      (cart.items || []).map(async (item: any) => {
        if (item.type === 'product' && item.productId) {
          const { data: product } = await supabase
            .from('products')
            .select('*')
            .eq('id', item.productId)
            .single();
          return { ...item, details: product };
        } else if (item.type === 'service' && item.serviceId) {
          const { data: service } = await supabase
            .from('services')
            .select('*')
            .eq('id', item.serviceId)
            .single();
          return { ...item, details: service };
        }
        return item;
      })
    );
    
    return c.json({ 
      cartItems: itemsWithDetails,
      totalItems: (cart.items || []).length,
      totalPrice: cart.total || 0,
      subtotal: cart.subtotal || 0,
      tax: cart.tax || 0,
      shipping: cart.shipping || 0,
      discount: cart.discount || 0
    });
  } catch (error) {
    console.log('Get cart error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Add item to cart
app.post("/customer/:customerId/cart", async (c) => {
  try {
    const { customerId } = c.req.param();
    const { itemId, type, name, price, quantity = 1, photo, vendorId } = await c.req.json();
    
    // ✅ SQL: Resolve customer ID
    const customersRepo = getCustomersRepository();
    let customer = await customersRepo.findById(customerId);
    if (!customer) {
      customer = await customersRepo.findByPhone(customerId);
    }
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Get or create cart
    const cartsRepo = getCartsRepository();
    const cart = await cartsRepo.findOrCreate(customer.id);
    
    const items = cart.items || [];
    const existingItemIndex = items.findIndex((item: any) => 
      (item.itemId === itemId || item.productId === itemId || item.serviceId === itemId) && item.type === type
    );
    
    if (existingItemIndex >= 0) {
      // Update quantity
      items[existingItemIndex].quantity += quantity;
      items[existingItemIndex].updatedAt = new Date().toISOString();
    } else {
      // Add new item
      const cartItem: any = {
        itemId,
        type,
        name,
        price,
        quantity,
        photo,
        vendorId,
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Set productId or serviceId based on type
      if (type === 'product') {
        cartItem.productId = itemId;
      } else if (type === 'service') {
        cartItem.serviceId = itemId;
      }
      
      items.push(cartItem);
    }
    
    // Recalculate totals
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.18; // 18% GST
    const total = subtotal + tax;
    
    // ✅ SQL: Update cart
    await cartsRepo.update(customer.id, {
      items,
      subtotal,
      tax,
      gst: tax,
      total
    });
    
    return c.json({ 
      success: true, 
      cartItems: items,
      totalItems: items.length 
    });
  } catch (error) {
    console.log('Add to cart error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Update cart item quantity
app.put("/customer/:customerId/cart/:itemId", async (c) => {
  try {
    const { customerId, itemId } = c.req.param();
    const { quantity } = await c.req.json();
    
    const cartItems = await kv.get(`cart:${customerId}`) || [];
    
    const itemIndex = cartItems.findIndex((item: any) => item.itemId === itemId);
    
    if (itemIndex === -1) {
      return c.json({ error: 'Item not found in cart' }, 404);
    }
    
    if (quantity <= 0) {
      // Remove item
      cartItems.splice(itemIndex, 1);
    } else {
      // Update quantity
      cartItems[itemIndex].quantity = quantity;
      cartItems[itemIndex].updatedAt = new Date().toISOString();
    }
    
    await kv.set(`cart:${customerId}`, cartItems);
    
    return c.json({ 
      success: true, 
      cartItems,
      totalItems: cartItems.length 
    });
  } catch (error) {
    console.log('Update cart error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Remove item from cart
app.delete("/customer/:customerId/cart/:itemId", async (c) => {
  try {
    const { customerId, itemId } = c.req.param();
    
    const cartItems = await kv.get(`cart:${customerId}`) || [];
    const updatedCartItems = cartItems.filter((item: any) => item.itemId !== itemId);
    
    await kv.set(`cart:${customerId}`, updatedCartItems);
    
    return c.json({ 
      success: true,
      cartItems: updatedCartItems,
      totalItems: updatedCartItems.length 
    });
  } catch (error) {
    console.log('Remove from cart error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Clear cart
app.delete("/customer/:customerId/cart", async (c) => {
  try {
    const { customerId } = c.req.param();
    
    await kv.set(`cart:${customerId}`, []);
    
    return c.json({ success: true, cartItems: [], totalItems: 0 });
  } catch (error) {
    console.log('Clear cart error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// SAVED ITEMS / FAVORITES (WISHLIST)
// ✅ MIGRATED TO SQL: Uses WishlistsRepository
// ============================================

// Get saved items
app.get("/customer/:customerId/saved", async (c) => {
  try {
    const { customerId } = c.req.param();
    
    // ✅ SQL: Resolve customer ID
    const customersRepo = getCustomersRepository();
    let customer = await customersRepo.findById(customerId);
    if (!customer) {
      customer = await customersRepo.findByPhone(customerId);
    }
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Get wishlist items
    const wishlistsRepo = getWishlistsRepository();
    const wishlistItems = await wishlistsRepo.findByCustomer(customer.id);
    
    // Get full details for each saved item
    const itemsWithDetails = await Promise.all(
      wishlistItems.map(async (item) => {
        let details = null;
        let type = '';
        
        if (item.product_id) {
          const { data: product } = await supabase
            .from('products')
            .select('*')
            .eq('id', item.product_id)
            .single();
          details = product;
          type = 'product';
        } else if (item.service_id) {
          const { data: service } = await supabase
            .from('services')
            .select('*')
            .eq('id', item.service_id)
            .single();
          details = service;
          type = 'service';
        }
        
        return {
          id: item.id,
          itemId: item.product_id || item.service_id,
          type,
          savedAt: item.created_at,
          details
        };
      })
    );
    
    return c.json({ 
      savedItems: itemsWithDetails.filter(item => item.details),
      totalItems: itemsWithDetails.length 
    });
  } catch (error) {
    console.log('Get saved items error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Add item to saved
app.post("/customer/:customerId/saved", async (c) => {
  try {
    const { customerId } = c.req.param();
    const { itemId, type } = await c.req.json();
    
    // ✅ SQL: Resolve customer ID
    const customersRepo = getCustomersRepository();
    let customer = await customersRepo.findById(customerId);
    if (!customer) {
      customer = await customersRepo.findByPhone(customerId);
    }
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Add to wishlist
    const wishlistsRepo = getWishlistsRepository();
    try {
      const wishlistItem = await wishlistsRepo.create({
        customer_id: customer.id,
        product_id: type === 'product' ? itemId : undefined,
        service_id: type === 'service' ? itemId : undefined
      });
      
      const allItems = await wishlistsRepo.findByCustomer(customer.id);
      
      return c.json({ 
        success: true, 
        savedItem: wishlistItem,
        totalItems: allItems.length 
      });
    } catch (error: any) {
      if (error.message.includes('already in wishlist')) {
        return c.json({ error: 'Item already saved' }, 400);
      }
      throw error;
    }
  } catch (error) {
    console.log('Add to saved error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Remove item from saved
app.delete("/customer/:customerId/saved/:itemId", async (c) => {
  try {
    const { customerId, itemId } = c.req.param();
    const { type } = c.req.query();
    
    // ✅ SQL: Resolve customer ID
    const customersRepo = getCustomersRepository();
    let customer = await customersRepo.findById(customerId);
    if (!customer) {
      customer = await customersRepo.findByPhone(customerId);
    }
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Find and delete wishlist item
    const wishlistsRepo = getWishlistsRepository();
    const wishlistItem = await wishlistsRepo.findByCustomerAndItem(
      customer.id,
      type === 'product' ? itemId : undefined,
      type === 'service' ? itemId : undefined
    );
    
    if (!wishlistItem) {
      return c.json({ error: 'Item not found in wishlist' }, 404);
    }
    
    await wishlistsRepo.delete(wishlistItem.id);
    
    const remainingItems = await wishlistsRepo.findByCustomer(customer.id);
    
    return c.json({ 
      success: true,
      totalItems: remainingItems.length 
    });
  } catch (error) {
    console.log('Remove from saved error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// ADDRESS MANAGEMENT
// ✅ MIGRATED TO SQL: Uses AddressesRepository
// ============================================

import { getAddressesRepository } from "../../lib/repositories/addresses.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";

// Get all addresses
app.get("/customer/:customerId/addresses", async (c) => {
  try {
    const { customerId } = c.req.param();
    
    // ✅ SQL: Resolve customer ID if needed
    const customersRepo = getCustomersRepository();
    let customer = await customersRepo.findById(customerId);
    if (!customer) {
      customer = await customersRepo.findByPhone(customerId);
    }
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Get addresses
    const addressesRepo = getAddressesRepository();
    const addresses = await addressesRepo.findByCustomer(customer.id);
    
    return c.json({ 
      addresses: addresses.map(addr => ({
        id: addr.id,
        customerId: addr.customer_id,
        label: addr.address_type,
        name: addr.full_name,
        phone: addr.phone,
        addressLine1: addr.address_line1,
        addressLine2: addr.address_line2,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        landmark: addr.landmark,
        isDefault: addr.is_default,
        createdAt: addr.created_at,
        updatedAt: addr.updated_at
      }))
    });
  } catch (error) {
    console.log('Get addresses error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Add new address
app.post("/customer/:customerId/addresses", async (c) => {
  try {
    const { customerId } = c.req.param();
    const { 
      label, 
      name, 
      phone, 
      addressLine1, 
      addressLine2, 
      city, 
      state, 
      pincode, 
      landmark,
      isDefault = false 
    } = await c.req.json();
    
    // ✅ SQL: Resolve customer ID
    const customersRepo = getCustomersRepository();
    let customer = await customersRepo.findById(customerId);
    if (!customer) {
      customer = await customersRepo.findByPhone(customerId);
    }
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Check if first address (auto-default)
    const addressesRepo = getAddressesRepository();
    const existingAddresses = await addressesRepo.findByCustomer(customer.id);
    const shouldBeDefault = isDefault || existingAddresses.length === 0;
    
    // ✅ SQL: Create address
    const address = await addressesRepo.create({
      customer_id: customer.id,
      address_type: (label || 'home') as 'home' | 'work' | 'other',
      full_name: name,
      phone,
      address_line1: addressLine1,
      address_line2: addressLine2,
      city,
      state,
      pincode,
      landmark,
      is_default: shouldBeDefault
    });
    
    // Get all addresses
    const allAddresses = await addressesRepo.findByCustomer(customer.id);
    
    return c.json({ 
      success: true, 
      address: {
        id: address.id,
        customerId: address.customer_id,
        label: address.address_type,
        name: address.full_name,
        phone: address.phone,
        addressLine1: address.address_line1,
        addressLine2: address.address_line2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        landmark: address.landmark,
        isDefault: address.is_default,
        createdAt: address.created_at,
        updatedAt: address.updated_at
      },
      addresses: allAddresses.map(addr => ({
        id: addr.id,
        customerId: addr.customer_id,
        label: addr.address_type,
        name: addr.full_name,
        phone: addr.phone,
        addressLine1: addr.address_line1,
        addressLine2: addr.address_line2,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        landmark: addr.landmark,
        isDefault: addr.is_default,
        createdAt: addr.created_at,
        updatedAt: addr.updated_at
      }))
    });
  } catch (error) {
    console.log('Add address error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Update address
app.put("/customer/:customerId/addresses/:addressId", async (c) => {
  try {
    const { customerId, addressId } = c.req.param();
    const updates = await c.req.json();
    
    // ✅ SQL: Resolve customer ID
    const customersRepo = getCustomersRepository();
    let customer = await customersRepo.findById(customerId);
    if (!customer) {
      customer = await customersRepo.findByPhone(customerId);
    }
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Update address
    const addressesRepo = getAddressesRepository();
    const address = await addressesRepo.findById(addressId);
    
    if (!address || address.customer_id !== customer.id) {
      return c.json({ error: 'Address not found' }, 404);
    }
    
    const updatedAddress = await addressesRepo.update(addressId, {
      address_type: updates.label || updates.address_type,
      full_name: updates.name || updates.full_name,
      phone: updates.phone,
      address_line1: updates.addressLine1 || updates.address_line1,
      address_line2: updates.addressLine2 || updates.address_line2,
      city: updates.city,
      state: updates.state,
      pincode: updates.pincode,
      landmark: updates.landmark,
      is_default: updates.isDefault !== undefined ? updates.isDefault : updates.is_default
    });
    
    // Get all addresses
    const allAddresses = await addressesRepo.findByCustomer(customer.id);
    
    return c.json({ 
      success: true, 
      address: {
        id: updatedAddress.id,
        customerId: updatedAddress.customer_id,
        label: updatedAddress.address_type,
        name: updatedAddress.full_name,
        phone: updatedAddress.phone,
        addressLine1: updatedAddress.address_line1,
        addressLine2: updatedAddress.address_line2,
        city: updatedAddress.city,
        state: updatedAddress.state,
        pincode: updatedAddress.pincode,
        landmark: updatedAddress.landmark,
        isDefault: updatedAddress.is_default,
        createdAt: updatedAddress.created_at,
        updatedAt: updatedAddress.updated_at
      },
      addresses: allAddresses.map(addr => ({
        id: addr.id,
        customerId: addr.customer_id,
        label: addr.address_type,
        name: addr.full_name,
        phone: addr.phone,
        addressLine1: addr.address_line1,
        addressLine2: addr.address_line2,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        landmark: addr.landmark,
        isDefault: addr.is_default,
        createdAt: addr.created_at,
        updatedAt: addr.updated_at
      }))
    });
  } catch (error) {
    console.log('Update address error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Delete address
app.delete("/customer/:customerId/addresses/:addressId", async (c) => {
  try {
    const { customerId, addressId } = c.req.param();
    
    // ✅ SQL: Resolve customer ID
    const customersRepo = getCustomersRepository();
    let customer = await customersRepo.findById(customerId);
    if (!customer) {
      customer = await customersRepo.findByPhone(customerId);
    }
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Check address exists and belongs to customer
    const addressesRepo = getAddressesRepository();
    const address = await addressesRepo.findById(addressId);
    
    if (!address || address.customer_id !== customer.id) {
      return c.json({ error: 'Address not found' }, 404);
    }
    
    // If deleting default, set first remaining as default
    if (address.is_default) {
      const allAddresses = await addressesRepo.findByCustomer(customer.id);
      const otherAddresses = allAddresses.filter(a => a.id !== addressId);
      if (otherAddresses.length > 0) {
        await addressesRepo.update(otherAddresses[0].id, { is_default: true });
      }
    }
    
    // ✅ SQL: Delete address
    await addressesRepo.delete(addressId);
    
    // Get remaining addresses
    const remainingAddresses = await addressesRepo.findByCustomer(customer.id);
    
    return c.json({ 
      success: true, 
      addresses: remainingAddresses.map(addr => ({
        id: addr.id,
        customerId: addr.customer_id,
        label: addr.address_type,
        name: addr.full_name,
        phone: addr.phone,
        addressLine1: addr.address_line1,
        addressLine2: addr.address_line2,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        landmark: addr.landmark,
        isDefault: addr.is_default,
        createdAt: addr.created_at,
        updatedAt: addr.updated_at
      }))
    });
  } catch (error) {
    console.log('Delete address error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// PAYMENT METHODS
// ✅ MIGRATED TO SQL: Uses PaymentCardsRepository
// Note: This endpoint is for backward compatibility. New implementations should use payment-cards-endpoints.tsx
// ============================================

// Get all payment methods
app.get("/customer/:customerId/payments", async (c) => {
  try {
    const { customerId } = c.req.param();
    
    // ✅ SQL: Resolve customer ID
    const customersRepo = getCustomersRepository();
    let customer = await customersRepo.findById(customerId);
    if (!customer) {
      customer = await customersRepo.findByPhone(customerId);
    }
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Get payment cards
    const cardsRepo = getPaymentCardsRepository();
    const cards = await cardsRepo.findByCustomer(customer.id);
    
    // Map to legacy format for backward compatibility
    const paymentMethods = cards.map((card) => ({
      id: card.id,
      customerId: card.customer_id,
      type: 'card',
      cardNumber: `****${card.last_four_digits}`,
      cardHolderName: card.card_holder_name,
      expiryMonth: card.expiry_month,
      expiryYear: card.expiry_year,
      cardType: card.card_type,
      isDefault: card.is_default,
      createdAt: card.created_at,
      updatedAt: card.updated_at
    }));
    
    return c.json({ paymentMethods });
  } catch (error) {
    console.log('Get payment methods error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Add new payment method
// Note: This endpoint should redirect to payment-cards-endpoints.tsx for card tokenization
app.post("/customer/:customerId/payments", async (c) => {
  try {
    return c.json({ 
      error: 'Please use /customer/:identifier/cards endpoint for adding payment methods. This endpoint requires card tokenization for security.',
      redirect: '/customer/:identifier/cards'
    }, 400);
  } catch (error) {
    console.log('Add payment method error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Update payment method
app.put("/customer/:customerId/payments/:paymentMethodId", async (c) => {
  try {
    const { customerId, paymentMethodId } = c.req.param();
    const updates = await c.req.json();
    
    // ✅ SQL: Resolve customer ID
    const customersRepo = getCustomersRepository();
    let customer = await customersRepo.findById(customerId);
    if (!customer) {
      customer = await customersRepo.findByPhone(customerId);
    }
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Update payment card
    const cardsRepo = getPaymentCardsRepository();
    const card = await cardsRepo.findById(paymentMethodId);
    
    if (!card || card.customer_id !== customer.id) {
      return c.json({ error: 'Payment method not found' }, 404);
    }
    
    const updatedCard = await cardsRepo.update(paymentMethodId, {
      card_holder_name: updates.cardHolderName,
      expiry_month: updates.expiryMonth,
      expiry_year: updates.expiryYear,
      is_default: updates.isDefault !== undefined ? updates.isDefault : card.is_default
    });
    
    return c.json({ 
      success: true, 
      paymentMethod: {
        id: updatedCard.id,
        cardNumber: `****${updatedCard.last_four_digits}`,
        cardHolderName: updatedCard.card_holder_name,
        expiryMonth: updatedCard.expiry_month,
        expiryYear: updatedCard.expiry_year,
        isDefault: updatedCard.is_default
      }
    });
  } catch (error) {
    console.log('Update payment method error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Delete payment method
app.delete("/customer/:customerId/payments/:paymentMethodId", async (c) => {
  try {
    const { customerId, paymentMethodId } = c.req.param();
    
    // ✅ SQL: Resolve customer ID
    const customersRepo = getCustomersRepository();
    let customer = await customersRepo.findById(customerId);
    if (!customer) {
      customer = await customersRepo.findByPhone(customerId);
    }
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Delete payment card
    const cardsRepo = getPaymentCardsRepository();
    const card = await cardsRepo.findById(paymentMethodId);
    
    if (!card || card.customer_id !== customer.id) {
      return c.json({ error: 'Payment method not found' }, 404);
    }
    
    await cardsRepo.delete(paymentMethodId);
    
    // If deleted card was default, set first remaining as default
    if (card.is_default) {
      const remainingCards = await cardsRepo.findByCustomer(customer.id);
      if (remainingCards.length > 0) {
        await cardsRepo.update(remainingCards[0].id, { is_default: true });
      }
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.log('Delete payment method error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// NOTIFICATION PREFERENCES
// ✅ MIGRATED TO SQL: Uses customer_notification_settings table
// ============================================

// Get notification settings
app.get("/customer/:customerId/notification-settings", async (c) => {
  try {
    const { customerId } = c.req.param();
    
    // ✅ SQL: Resolve customer ID
    const customersRepo = getCustomersRepository();
    let customer = await customersRepo.findById(customerId);
    if (!customer) {
      customer = await customersRepo.findByPhone(customerId);
    }
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Get notification settings
    const { data: settings, error } = await supabase
      .from('customer_notification_settings')
      .select('*')
      .eq('customer_id', customer.id)
      .single();
    
    // Default settings if not exists
    if (error || !settings) {
      const defaultSettings = {
        push_enabled: true,
        email_enabled: false,
        sms_enabled: true,
        booking_updates: true,
        promotions: true,
        new_services: false,
        newsletter: false
      };
      
      const { data: newSettings } = await supabase
        .from('customer_notification_settings')
        .insert({
          customer_id: customer.id,
          ...defaultSettings
        })
        .select()
        .single();
      
      return c.json({ 
        settings: {
          push: newSettings?.push_enabled,
          email: newSettings?.email_enabled,
          sms: newSettings?.sms_enabled,
          bookingUpdates: newSettings?.booking_updates,
          promotions: newSettings?.promotions,
          newServices: newSettings?.new_services,
          newsletter: newSettings?.newsletter
        }
      });
    }
    
    return c.json({ 
      settings: {
        push: settings.push_enabled,
        email: settings.email_enabled,
        sms: settings.sms_enabled,
        bookingUpdates: settings.booking_updates,
        promotions: settings.promotions,
        newServices: settings.new_services,
        newsletter: settings.newsletter
      }
    });
  } catch (error) {
    console.log('Get notification settings error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Update notification settings
app.put("/customer/:customerId/notification-settings", async (c) => {
  try {
    const { customerId } = c.req.param();
    const updates = await c.req.json();
    
    // ✅ SQL: Resolve customer ID
    const customersRepo = getCustomersRepository();
    let customer = await customersRepo.findById(customerId);
    if (!customer) {
      customer = await customersRepo.findByPhone(customerId);
    }
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Upsert notification settings
    const { data: updatedSettings, error } = await supabase
      .from('customer_notification_settings')
      .upsert({
        customer_id: customer.id,
        push_enabled: updates.push !== undefined ? updates.push : undefined,
        email_enabled: updates.email !== undefined ? updates.email : undefined,
        sms_enabled: updates.sms !== undefined ? updates.sms : undefined,
        booking_updates: updates.bookingUpdates !== undefined ? updates.bookingUpdates : undefined,
        promotions: updates.promotions !== undefined ? updates.promotions : undefined,
        new_services: updates.newServices !== undefined ? updates.newServices : undefined,
        newsletter: updates.newsletter !== undefined ? updates.newsletter : undefined,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'customer_id'
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return c.json({ 
      success: true, 
      settings: {
        push: updatedSettings.push_enabled,
        email: updatedSettings.email_enabled,
        sms: updatedSettings.sms_enabled,
        bookingUpdates: updatedSettings.booking_updates,
        promotions: updatedSettings.promotions,
        newServices: updatedSettings.new_services,
        newsletter: updatedSettings.newsletter
      }
    });
  } catch (error) {
    console.log('Update notification settings error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
