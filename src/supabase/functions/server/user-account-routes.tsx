import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// ============================================
// CART MANAGEMENT
// ============================================

// Get customer cart
app.get("/customer/:customerId/cart", async (c) => {
  try {
    const { customerId } = c.req.param();
    
    const cartItems = await kv.get(`cart:${customerId}`) || [];
    
    // Get full details for each cart item
    const itemsWithDetails = await Promise.all(
      cartItems.map(async (item: any) => {
        if (item.type === 'product') {
          const product = await kv.get(`product:${item.itemId}`);
          return { ...item, details: product };
        } else if (item.type === 'service') {
          const service = await kv.get(`service:${item.itemId}`);
          return { ...item, details: service };
        }
        return item;
      })
    );
    
    return c.json({ 
      cartItems: itemsWithDetails,
      totalItems: cartItems.length,
      totalPrice: cartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
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
    
    const cartItems = await kv.get(`cart:${customerId}`) || [];
    
    // Check if item already exists in cart
    const existingItemIndex = cartItems.findIndex((item: any) => 
      item.itemId === itemId && item.type === type
    );
    
    if (existingItemIndex >= 0) {
      // Update quantity
      cartItems[existingItemIndex].quantity += quantity;
      cartItems[existingItemIndex].updatedAt = new Date().toISOString();
    } else {
      // Add new item
      const cartItem = {
        itemId,
        type, // 'product' or 'service'
        name,
        price,
        quantity,
        photo,
        vendorId,
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      cartItems.push(cartItem);
    }
    
    await kv.set(`cart:${customerId}`, cartItems);
    
    return c.json({ 
      success: true, 
      cartItems,
      totalItems: cartItems.length 
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
// SAVED ITEMS / FAVORITES
// ============================================

// Get saved items
app.get("/customer/:customerId/saved", async (c) => {
  try {
    const { customerId } = c.req.param();
    
    const savedItems = await kv.get(`saved:${customerId}`) || [];
    
    // Get full details for each saved item
    const itemsWithDetails = await Promise.all(
      savedItems.map(async (item: any) => {
        if (item.type === 'product') {
          const product = await kv.get(`product:${item.itemId}`);
          return { ...item, details: product };
        } else if (item.type === 'service') {
          const service = await kv.get(`service:${item.itemId}`);
          return { ...item, details: service };
        } else if (item.type === 'vendor') {
          const vendor = await kv.get(`vendor:${item.itemId}`);
          return { ...item, details: vendor };
        }
        return item;
      })
    );
    
    return c.json({ 
      savedItems: itemsWithDetails.filter(item => item.details),
      totalItems: savedItems.length 
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
    const { itemId, type, name, photo } = await c.req.json();
    
    const savedItems = await kv.get(`saved:${customerId}`) || [];
    
    // Check if already saved
    const exists = savedItems.some((item: any) => 
      item.itemId === itemId && item.type === type
    );
    
    if (exists) {
      return c.json({ error: 'Item already saved' }, 400);
    }
    
    const savedItem = {
      itemId,
      type, // 'product', 'service', 'vendor'
      name,
      photo,
      savedAt: new Date().toISOString()
    };
    
    savedItems.unshift(savedItem);
    await kv.set(`saved:${customerId}`, savedItems);
    
    return c.json({ 
      success: true, 
      savedItems,
      totalItems: savedItems.length 
    });
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
    
    const savedItems = await kv.get(`saved:${customerId}`) || [];
    const updatedSavedItems = savedItems.filter((item: any) => 
      !(item.itemId === itemId && item.type === type)
    );
    
    await kv.set(`saved:${customerId}`, updatedSavedItems);
    
    return c.json({ 
      success: true,
      savedItems: updatedSavedItems,
      totalItems: updatedSavedItems.length 
    });
  } catch (error) {
    console.log('Remove from saved error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// ADDRESS MANAGEMENT
// ============================================

// Get all addresses
app.get("/customer/:customerId/addresses", async (c) => {
  try {
    const { customerId } = c.req.param();
    
    const addresses = await kv.get(`addresses:${customerId}`) || [];
    
    return c.json({ addresses });
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
      coordinates,
      isDefault = false 
    } = await c.req.json();
    
    const addressId = `address_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const addresses = await kv.get(`addresses:${customerId}`) || [];
    
    // If this is default, unset all others
    if (isDefault) {
      addresses.forEach((addr: any) => addr.isDefault = false);
    }
    
    // If this is the first address, make it default
    const shouldBeDefault = isDefault || addresses.length === 0;
    
    const address = {
      id: addressId,
      customerId,
      label, // 'Home', 'Work', 'Other'
      name,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      landmark,
      coordinates,
      isDefault: shouldBeDefault,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    addresses.push(address);
    await kv.set(`addresses:${customerId}`, addresses);
    
    return c.json({ success: true, address, addresses });
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
    
    const addresses = await kv.get(`addresses:${customerId}`) || [];
    const addressIndex = addresses.findIndex((addr: any) => addr.id === addressId);
    
    if (addressIndex === -1) {
      return c.json({ error: 'Address not found' }, 404);
    }
    
    // If setting as default, unset all others
    if (updates.isDefault) {
      addresses.forEach((addr: any) => addr.isDefault = false);
    }
    
    addresses[addressIndex] = {
      ...addresses[addressIndex],
      ...updates,
      id: addressId,
      customerId,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`addresses:${customerId}`, addresses);
    
    return c.json({ success: true, address: addresses[addressIndex], addresses });
  } catch (error) {
    console.log('Update address error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Delete address
app.delete("/customer/:customerId/addresses/:addressId", async (c) => {
  try {
    const { customerId, addressId } = c.req.param();
    
    const addresses = await kv.get(`addresses:${customerId}`) || [];
    const addressToDelete = addresses.find((addr: any) => addr.id === addressId);
    
    if (!addressToDelete) {
      return c.json({ error: 'Address not found' }, 404);
    }
    
    const updatedAddresses = addresses.filter((addr: any) => addr.id !== addressId);
    
    // If deleted address was default and there are other addresses, make the first one default
    if (addressToDelete.isDefault && updatedAddresses.length > 0) {
      updatedAddresses[0].isDefault = true;
    }
    
    await kv.set(`addresses:${customerId}`, updatedAddresses);
    
    return c.json({ success: true, addresses: updatedAddresses });
  } catch (error) {
    console.log('Delete address error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// PAYMENT METHODS
// ============================================

// Get all payment methods
app.get("/customer/:customerId/payments", async (c) => {
  try {
    const { customerId } = c.req.param();
    
    const paymentMethods = await kv.get(`payments:${customerId}`) || [];
    
    // Mask card numbers for security
    const maskedPaymentMethods = paymentMethods.map((pm: any) => ({
      ...pm,
      cardNumber: pm.cardNumber ? `****${pm.cardNumber.slice(-4)}` : undefined,
      cvv: undefined // Never return CVV
    }));
    
    return c.json({ paymentMethods: maskedPaymentMethods });
  } catch (error) {
    console.log('Get payment methods error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Add new payment method
app.post("/customer/:customerId/payments", async (c) => {
  try {
    const { customerId } = c.req.param();
    const { 
      type, // 'card', 'upi', 'netbanking'
      cardNumber, 
      cardHolderName, 
      expiryMonth, 
      expiryYear,
      cardType, // 'visa', 'mastercard', 'rupay', 'amex'
      upiId,
      bankName,
      isDefault = false 
    } = await c.req.json();
    
    const paymentMethodId = `payment_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const paymentMethods = await kv.get(`payments:${customerId}`) || [];
    
    // If this is default, unset all others
    if (isDefault) {
      paymentMethods.forEach((pm: any) => pm.isDefault = false);
    }
    
    // If this is the first payment method, make it default
    const shouldBeDefault = isDefault || paymentMethods.length === 0;
    
    const paymentMethod = {
      id: paymentMethodId,
      customerId,
      type,
      // Store last 4 digits only for display
      cardNumber: cardNumber ? cardNumber.slice(-4) : undefined,
      cardHolderName,
      expiryMonth,
      expiryYear,
      cardType,
      upiId,
      bankName,
      isDefault: shouldBeDefault,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    paymentMethods.push(paymentMethod);
    await kv.set(`payments:${customerId}`, paymentMethods);
    
    return c.json({ success: true, paymentMethod, paymentMethods });
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
    
    const paymentMethods = await kv.get(`payments:${customerId}`) || [];
    const pmIndex = paymentMethods.findIndex((pm: any) => pm.id === paymentMethodId);
    
    if (pmIndex === -1) {
      return c.json({ error: 'Payment method not found' }, 404);
    }
    
    // If setting as default, unset all others
    if (updates.isDefault) {
      paymentMethods.forEach((pm: any) => pm.isDefault = false);
    }
    
    paymentMethods[pmIndex] = {
      ...paymentMethods[pmIndex],
      ...updates,
      id: paymentMethodId,
      customerId,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`payments:${customerId}`, paymentMethods);
    
    return c.json({ success: true, paymentMethod: paymentMethods[pmIndex], paymentMethods });
  } catch (error) {
    console.log('Update payment method error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Delete payment method
app.delete("/customer/:customerId/payments/:paymentMethodId", async (c) => {
  try {
    const { customerId, paymentMethodId } = c.req.param();
    
    const paymentMethods = await kv.get(`payments:${customerId}`) || [];
    const pmToDelete = paymentMethods.find((pm: any) => pm.id === paymentMethodId);
    
    if (!pmToDelete) {
      return c.json({ error: 'Payment method not found' }, 404);
    }
    
    const updatedPaymentMethods = paymentMethods.filter((pm: any) => pm.id !== paymentMethodId);
    
    // If deleted payment method was default and there are others, make the first one default
    if (pmToDelete.isDefault && updatedPaymentMethods.length > 0) {
      updatedPaymentMethods[0].isDefault = true;
    }
    
    await kv.set(`payments:${customerId}`, updatedPaymentMethods);
    
    return c.json({ success: true, paymentMethods: updatedPaymentMethods });
  } catch (error) {
    console.log('Delete payment method error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// NOTIFICATION PREFERENCES
// ============================================

// Get notification settings
app.get("/customer/:customerId/notification-settings", async (c) => {
  try {
    const { customerId } = c.req.param();
    
    let settings = await kv.get(`notification-settings:${customerId}`);
    
    // Default settings if not exists
    if (!settings) {
      settings = {
        push: true,
        email: false,
        sms: true,
        bookingUpdates: true,
        promotions: true,
        newServices: false,
        newsletter: false
      };
      await kv.set(`notification-settings:${customerId}`, settings);
    }
    
    return c.json({ settings });
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
    
    const currentSettings = await kv.get(`notification-settings:${customerId}`) || {};
    
    const updatedSettings = {
      ...currentSettings,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`notification-settings:${customerId}`, updatedSettings);
    
    return c.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.log('Update notification settings error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
