/**
 * Shop Dashboard Screen - Mobile
 * Handles pet shop product browsing, categories, and shopping
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

type ViewType = 
  | 'dashboard'
  | 'product_detail'
  | 'cart'
  | 'checkout'
  | 'confirmation';

interface ShopDashboardScreenProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  data?: any;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  image: string;
  category: string;
  vendor: {
    name: string;
    rating: number;
    location: string;
    deliveryTime: string;
  };
  stock: string;
  badge?: string;
  discount?: string;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '🏪' },
  { id: 'food', label: 'Food', icon: '🍖' },
  { id: 'toys', label: 'Toys', icon: '🎾' },
  { id: 'clothes', label: 'Clothes', icon: '👕' },
  { id: 'accessories', label: 'Accessories', icon: '🎀' },
  { id: 'medicine', label: 'Medicine', icon: '💊' },
  { id: 'grooming', label: 'Grooming', icon: '✂️' },
  { id: 'beds', label: 'Beds', icon: '🛏️' },
  { id: 'bowls', label: 'Bowls', icon: '🥣' },
];

const BANNERS = [
  {
    title: '🎉 MEGA SALE',
    subtitle: 'Up to 50% OFF on Pet Food',
    bgColor: '#667eea',
  },
  {
    title: '🏃 FREE DELIVERY',
    subtitle: 'On orders above ₹999',
    bgColor: '#f5576c',
  },
  {
    title: '🎁 NEW ARRIVALS',
    subtitle: 'Latest toys & accessories',
    bgColor: '#4facfe',
  },
];

export function ShopDashboardScreen({
  phone,
  onBack,
  onNavigate,
  onViewBooking,
  data,
}: ShopDashboardScreenProps) {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, selectedCategory, searchQuery]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % BANNERS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      // Load products from API
      const response = await CustomerApi.searchProducts('', selectedCategory !== 'all' ? selectedCategory : undefined);
      const productsData = Array.isArray(response) ? response : (response as any).products || [];
      
      const formattedProducts: Product[] = productsData.map((prod: any) => ({
        id: prod.id || prod.productId,
        name: prod.name || prod.productName,
        description: prod.description || '',
        price: prod.price || prod.unitPrice || 0,
        originalPrice: prod.originalPrice || prod.mrp,
        rating: prod.rating || prod.averageRating || 4.5,
        reviews: prod.reviewCount || prod.reviews || 0,
        image: prod.image || prod.imageUrl || '',
        category: prod.category || 'general',
        vendor: {
          name: prod.vendorName || 'Vendor',
          rating: prod.vendorRating || 4.5,
          location: prod.vendorLocation || '',
          deliveryTime: prod.deliveryTime || '2-3 days',
        },
        stock: prod.inStock ? 'In Stock' : 'Out of Stock',
        badge: prod.badge || prod.tag || '',
        discount: prod.discount ? `${prod.discount}%` : undefined,
      }));
      
      setProducts(formattedProducts);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    }
    
    setFilteredProducts(filtered);
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 1,
      }]);
    }
    
    Alert.alert('Added to Cart', `${product.name} added to cart`);
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    const item = cart.find(item => item.id === productId);
    if (!item) return;
    
    const newQuantity = item.quantity + delta;
    if (newQuantity <= 0) {
      setCart(cart.filter(item => item.id !== productId));
    } else {
      setCart(cart.map(item =>
        item.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      ));
    }
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return;
    }

    try {
      setLoading(true);
      // TODO: Implement actual checkout API call
      setCurrentView('confirmation');
    } catch (error) {
      console.error('Error during checkout:', error);
      Alert.alert('Error', 'Failed to process order');
    } finally {
      setLoading(false);
    }
  };

  const renderDashboard = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shop</Text>
        <TouchableOpacity
          onPress={() => setCurrentView('cart')}
          style={styles.cartButton}
        >
          <Text style={styles.cartIcon}>🛒</Text>
          {cart.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products, brands..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryChip,
              selectedCategory === cat.id && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === cat.id && styles.categoryChipTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.dashboardContent}>
        {/* Banner Carousel */}
        <View style={styles.bannerContainer}>
          <View
            style={[
              styles.banner,
              { backgroundColor: BANNERS[currentBannerIndex].bgColor },
            ]}
          >
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>
                {BANNERS[currentBannerIndex].title}
              </Text>
              <Text style={styles.bannerSubtitle}>
                {BANNERS[currentBannerIndex].subtitle}
              </Text>
              <TouchableOpacity style={styles.bannerButton}>
                <Text style={styles.bannerButtonText}>Shop Now</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.bannerEmoji}>🛍️</Text>
          </View>
          <View style={styles.bannerDots}>
            {BANNERS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.bannerDot,
                  index === currentBannerIndex && styles.bannerDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Quick Features */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🚚</Text>
            <Text style={styles.featureLabel}>Free Delivery</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🛡️</Text>
            <Text style={styles.featureLabel}>100% Genuine</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>⚡</Text>
            <Text style={styles.featureLabel}>Fast Shipping</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📦</Text>
            <Text style={styles.featureLabel}>Easy Returns</Text>
          </View>
        </View>

        {/* Hot Deals */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔥 Hot Deals</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>View All →</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.productsHorizontal}
          >
            {products.slice(0, 4).map(product => (
              <TouchableOpacity
                key={product.id}
                style={styles.productCardHorizontal}
                onPress={() => {
                  setSelectedProduct(product);
                  setCurrentView('product_detail');
                }}
              >
                <View style={styles.productImageContainer}>
                  <Image
                    source={{ uri: product.image }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                  {product.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{product.badge}</Text>
                    </View>
                  )}
                  {product.discount && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>
                        {product.discount} OFF
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <View style={styles.vendorInfo}>
                    <Text style={styles.vendorName}>{product.vendor.name}</Text>
                    <Text style={styles.ratingIcon}>⭐</Text>
                    <Text style={styles.ratingText}>
                      {product.vendor.rating}
                    </Text>
                  </View>
                  <View style={styles.productRating}>
                    <Text style={styles.ratingIcon}>⭐</Text>
                    <Text style={styles.ratingText}>{product.rating}</Text>
                    <Text style={styles.reviewsText}>({product.reviews})</Text>
                  </View>
                  <View style={styles.productPriceContainer}>
                    <Text style={styles.productPrice}>₹{product.price}</Text>
                    {product.originalPrice && (
                      <Text style={styles.originalPrice}>
                        ₹{product.originalPrice}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.stockText}>{product.stock}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Top Products Grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Products</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>View All →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.productsGrid}>
            {filteredProducts.map(product => (
              <TouchableOpacity
                key={product.id}
                style={styles.productCard}
                onPress={() => {
                  setSelectedProduct(product);
                  setCurrentView('product_detail');
                }}
              >
                <View style={styles.productImageContainer}>
                  <Image
                    source={{ uri: product.image }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productCategory}>{product.category}</Text>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <View style={styles.vendorBadge}>
                    <Text style={styles.vendorBadgeText}>
                      {product.vendor.name}
                    </Text>
                  </View>
                  <View style={styles.productRating}>
                    <Text style={styles.ratingIcon}>⭐</Text>
                    <Text style={styles.ratingText}>{product.rating}</Text>
                    <Text style={styles.deliveryText}>
                      • {product.vendor.deliveryTime}
                    </Text>
                  </View>
                  <Text style={styles.productPrice}>₹{product.price}</Text>
                  <TouchableOpacity
                    style={styles.addToCartButton}
                    onPress={() => addToCart(product)}
                  >
                    <Text style={styles.addToCartButtonText}>Add to Cart</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Benefits Section */}
        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>Why Shop With Us?</Text>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>✅</Text>
            <View>
              <Text style={styles.benefitTitle}>100% Authentic Products</Text>
              <Text style={styles.benefitDesc}>
                Genuine brands & quality guaranteed
              </Text>
            </View>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>🚚</Text>
            <View>
              <Text style={styles.benefitTitle}>Fast & Free Delivery</Text>
              <Text style={styles.benefitDesc}>
                Free shipping on orders above ₹999
              </Text>
            </View>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>💰</Text>
            <View>
              <Text style={styles.benefitTitle}>Best Price Guarantee</Text>
              <Text style={styles.benefitDesc}>
                Lowest prices in the market
              </Text>
            </View>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>🔒</Text>
            <View>
              <Text style={styles.benefitTitle}>Secure Payments</Text>
              <Text style={styles.benefitDesc}>
                Safe & encrypted transactions
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const renderProductDetail = () => {
    if (!selectedProduct) return null;

    const quantity = cart.find(item => item.id === selectedProduct.id)?.quantity || 0;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentView('dashboard')}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedProduct.name}</Text>
        </View>

        <ScrollView style={styles.productDetailContainer}>
          <Image
            source={{ uri: selectedProduct.image }}
            style={styles.productDetailImage}
            resizeMode="cover"
          />
          <View style={styles.productDetailInfo}>
            <Text style={styles.productDetailName}>{selectedProduct.name}</Text>
            <Text style={styles.productDetailDescription}>
              {selectedProduct.description}
            </Text>
            <View style={styles.productDetailRating}>
              <Text style={styles.ratingIcon}>⭐</Text>
              <Text style={styles.ratingText}>{selectedProduct.rating}</Text>
              <Text style={styles.reviewsText}>({selectedProduct.reviews} reviews)</Text>
            </View>
            <View style={styles.productDetailPriceContainer}>
              <Text style={styles.productDetailPrice}>₹{selectedProduct.price}</Text>
              {selectedProduct.originalPrice && (
                <Text style={styles.productDetailOriginalPrice}>
                  ₹{selectedProduct.originalPrice}
                </Text>
              )}
            </View>
            <View style={styles.vendorInfoDetail}>
              <Text style={styles.vendorInfoText}>
                Vendor: {selectedProduct.vendor.name} ⭐ {selectedProduct.vendor.rating}
              </Text>
              <Text style={styles.vendorInfoText}>
                Delivery: {selectedProduct.vendor.deliveryTime}
              </Text>
            </View>
            <View style={styles.quantitySelector}>
              <Text style={styles.quantityLabel}>Quantity:</Text>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateCartQuantity(selectedProduct.id, -1)}
                >
                  <Text style={styles.quantityButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.quantityValue}>{quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => addToCart(selectedProduct)}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => addToCart(selectedProduct)}
            >
              <Text style={styles.primaryButtonText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderCart = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('dashboard')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shopping Cart</Text>
      </View>

      <ScrollView style={styles.cartContainer}>
        {cart.length === 0 ? (
          <View style={styles.emptyCart}>
            <Text style={styles.emptyCartIcon}>🛒</Text>
            <Text style={styles.emptyCartText}>Your cart is empty</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setCurrentView('dashboard')}
            >
              <Text style={styles.primaryButtonText}>Browse Products</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {cart.map(item => (
              <View key={item.id} style={styles.cartItem}>
                <Image
                  source={{ uri: item.image }}
                  style={styles.cartItemImage}
                  resizeMode="cover"
                />
                <View style={styles.cartItemInfo}>
                  <Text style={styles.cartItemName}>{item.name}</Text>
                  <Text style={styles.cartItemPrice}>₹{item.price}</Text>
                  <View style={styles.cartItemQuantity}>
                    <TouchableOpacity
                      style={styles.quantityButtonSmall}
                      onPress={() => updateCartQuantity(item.id, -1)}
                    >
                      <Text style={styles.quantityButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.quantityValueSmall}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.quantityButtonSmall}
                      onPress={() => updateCartQuantity(item.id, 1)}
                    >
                      <Text style={styles.quantityButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.cartItemTotal}>
                  ₹{item.price * item.quantity}
                </Text>
              </View>
            ))}
            <View style={styles.cartSummary}>
              <View style={styles.cartSummaryRow}>
                <Text style={styles.cartSummaryLabel}>Subtotal</Text>
                <Text style={styles.cartSummaryValue}>₹{getCartTotal()}</Text>
              </View>
              <View style={styles.cartSummaryRow}>
                <Text style={styles.cartSummaryLabel}>Delivery</Text>
                <Text style={styles.cartSummaryValue}>Free</Text>
              </View>
              <View style={styles.cartSummaryTotal}>
                <Text style={styles.cartSummaryTotalLabel}>Total</Text>
                <Text style={styles.cartSummaryTotalValue}>₹{getCartTotal()}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setCurrentView('checkout')}
            >
              <Text style={styles.primaryButtonText}>Proceed to Checkout</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );

  const renderCheckout = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('cart')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
      </View>

      <ScrollView style={styles.checkoutContainer}>
        <View style={styles.checkoutSection}>
          <Text style={styles.checkoutSectionTitle}>Order Summary</Text>
          {cart.map(item => (
            <View key={item.id} style={styles.checkoutItem}>
              <Text style={styles.checkoutItemName}>
                {item.name} x{item.quantity}
              </Text>
              <Text style={styles.checkoutItemPrice}>₹{item.price * item.quantity}</Text>
            </View>
          ))}
          <View style={styles.checkoutTotal}>
            <Text style={styles.checkoutTotalLabel}>Total</Text>
            <Text style={styles.checkoutTotalValue}>₹{getCartTotal()}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleCheckout}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Place Order</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderConfirmation = () => (
    <View style={styles.container}>
      <View style={styles.confirmationContainer}>
        <Text style={styles.confirmationIcon}>✅</Text>
        <Text style={styles.confirmationTitle}>Order Placed!</Text>
        <Text style={styles.confirmationMessage}>
          Your order has been placed successfully. You will receive a confirmation shortly.
        </Text>
        <View style={styles.confirmationDetails}>
          <Text style={styles.confirmationDetailText}>
            Order Total: ₹{getCartTotal()}
          </Text>
          <Text style={styles.confirmationDetailText}>
            Items: {cart.reduce((sum, item) => sum + item.quantity, 0)}
          </Text>
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={onBack}>
          <Text style={styles.primaryButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && currentView === 'dashboard') {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {currentView === 'dashboard' && renderDashboard()}
      {currentView === 'product_detail' && renderProductDetail()}
      {currentView === 'cart' && renderCart()}
      {currentView === 'checkout' && renderCheckout()}
      {currentView === 'confirmation' && renderConfirmation()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  backButton: {
    fontSize: typography.body,
    color: '#fff',
  },
  headerTitle: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginLeft: spacing.md,
  },
  cartButton: {
    position: 'relative',
  },
  cartIcon: {
    fontSize: 24,
    color: '#fff',
  },
  cartBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchContainer: {
    padding: spacing.md,
    backgroundColor: '#fff',
  },
  searchInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: typography.body,
  },
  categoriesContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoriesContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: '#F9FAFB',
    marginRight: spacing.sm,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  categoryChipText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  dashboardContent: {
    flex: 1,
  },
  bannerContainer: {
    margin: spacing.md,
    position: 'relative',
  },
  banner: {
    height: 180,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: spacing.xs,
  },
  bannerSubtitle: {
    fontSize: typography.body,
    color: '#fff',
    opacity: 0.9,
    marginBottom: spacing.md,
  },
  bannerButton: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  bannerButtonText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  bannerEmoji: {
    fontSize: 48,
  },
  bannerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  bannerDotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  featuresContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  featureItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  featureLabel: {
    fontSize: typography.caption,
    color: colors.text,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
  },
  sectionLink: {
    fontSize: typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  productsHorizontal: {
    paddingHorizontal: spacing.md,
  },
  productCardHorizontal: {
    width: 200,
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  productCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  productImageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F9FAFB',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    backgroundColor: '#EF4444',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  discountBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: '#EF4444',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  productInfo: {
    padding: spacing.sm,
  },
  productCategory: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  productName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
    minHeight: 40,
  },
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  vendorName: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  vendorBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  vendorBadgeText: {
    fontSize: typography.caption,
    color: '#1E40AF',
    fontWeight: '600',
  },
  vendorInfoDetail: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  vendorInfoText: {
    fontSize: typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  productRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  ratingIcon: {
    fontSize: 12,
    marginRight: 2,
  },
  ratingText: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.text,
    marginRight: 4,
  },
  reviewsText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  deliveryText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  productPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  productPrice: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  originalPrice: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
    marginLeft: spacing.xs,
  },
  stockText: {
    fontSize: typography.caption,
    color: '#10B981',
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  addToCartButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  addToCartButtonText: {
    color: '#fff',
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  benefitsSection: {
    backgroundColor: '#FEE2E2',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    margin: spacing.md,
  },
  benefitsTitle: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  benefitIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  benefitTitle: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  benefitDesc: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  productDetailContainer: {
    flex: 1,
  },
  productDetailImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#F9FAFB',
  },
  productDetailInfo: {
    padding: spacing.md,
  },
  productDetailName: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  productDetailDescription: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  productDetailRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  productDetailPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  productDetailPrice: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.primary,
    marginRight: spacing.sm,
  },
  productDetailOriginalPrice: {
    fontSize: typography.h3,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  quantitySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  quantityLabel: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonSmall: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: '#fff',
    fontSize: typography.h3,
    fontWeight: 'bold',
  },
  quantityValue: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
    minWidth: 40,
    textAlign: 'center',
  },
  quantityValueSmall: {
    fontSize: typography.body,
    fontWeight: 'bold',
    color: colors.text,
    minWidth: 30,
    textAlign: 'center',
  },
  cartContainer: {
    flex: 1,
    padding: spacing.md,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyCartIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyCartText: {
    fontSize: typography.h3,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cartItemImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: '#E5E7EB',
  },
  cartItemInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  cartItemName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cartItemPrice: {
    fontSize: typography.body,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  cartItemQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cartItemTotal: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    alignSelf: 'flex-start',
  },
  cartSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  cartSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cartSummaryLabel: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  cartSummaryValue: {
    fontSize: typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  cartSummaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cartSummaryTotalLabel: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
  },
  cartSummaryTotalValue: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.primary,
  },
  checkoutContainer: {
    flex: 1,
    padding: spacing.md,
  },
  checkoutSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  checkoutSectionTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  checkoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  checkoutItemName: {
    fontSize: typography.body,
    color: colors.text,
  },
  checkoutItemPrice: {
    fontSize: typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  checkoutTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  checkoutTotalLabel: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
  },
  checkoutTotalValue: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.primary,
  },
  confirmationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  confirmationIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  confirmationTitle: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  confirmationMessage: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  confirmationDetails: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
  },
  confirmationDetailText: {
    fontSize: typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: typography.body,
    fontWeight: 'bold',
  },
});

