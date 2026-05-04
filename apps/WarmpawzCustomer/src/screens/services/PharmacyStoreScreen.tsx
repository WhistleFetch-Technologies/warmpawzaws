/**
 * Pharmacy Store Screen - Mobile
 * Handles pharmacy product browsing, cart, and ordering
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { BrandedStackBelowHeader } from '../../components/layout/BrandedStackBelowHeader';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';
import { customerFacingRating, normalizeReviewCount } from '../../utils/rating-display';
import { hasEffectivePriceReduction } from '@warmpawz/shared-types';

type ViewType = 
  | 'landing'
  | 'store'
  | 'product_detail'
  | 'cart'
  | 'checkout'
  | 'confirmation';

interface PharmacyStoreScreenProps {
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
  prescriptionRequired: boolean;
  vendorId: string;
  vendorName: string;
  inStock: boolean;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  prescriptionRequired: boolean;
  vendorId: string;
  vendorName: string;
  quantity: number;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'prescription', label: 'Prescription' },
  { id: 'otc', label: 'OTC' },
  { id: 'supplements', label: 'Supplements' },
  { id: 'accessories', label: 'Accessories' },
];

export function PharmacyStoreScreen({
  phone,
  onBack,
  onNavigate,
  onViewBooking,
  data,
}: PharmacyStoreScreenProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [stats, setStats] = useState({
    activePharmacies: 0,
    orders: '50K+',
    rating: '—' as string,
  });

  useEffect(() => {
    loadPharmacyData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, activeCategory, searchQuery]);

  const loadPharmacyData = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getServices({ roleId: 'pet_pharmacy' });
      const services = (response as any).services || [];
      
      // Get unique pharmacies
      const pharmacyMap = new Map();
      services.forEach((service: any) => {
        const vendorId = service.vendorId;
        if (!pharmacyMap.has(vendorId)) {
          const rc =
            Number(service.vendorReviewCount ?? service.vendor_review_count ?? 0) || 0;
          const r =
            service.vendorRating != null ? Number(service.vendorRating) : NaN;
          const rating =
            rc > 0 && Number.isFinite(r) && r > 0 ? r : 0;
          pharmacyMap.set(vendorId, {
            id: vendorId,
            name: service.vendorName,
            rating,
            reviewCount: rc,
            completedOrders: service.vendorReviewCount || 0,
          });
        }
      });
      
      const allPharmacies = Array.from(pharmacyMap.values());
      setPharmacies(allPharmacies);
      
      const rated = allPharmacies.filter(
        (p: any) =>
          (p.reviewCount ?? 0) > 0 && p.rating != null && Number(p.rating) > 0
      );
      const avgRating =
        rated.length > 0
          ? (
              rated.reduce((acc: number, p: any) => acc + Number(p.rating), 0) /
              rated.length
            ).toFixed(1)
          : '—';

      setStats({
        activePharmacies: allPharmacies.length || 0,
        orders: '50K+',
        rating: avgRating,
      });

      // Load products from API
      try {
        if (allPharmacies.length > 0) {
          // Try to get products from first pharmacy
          const pharmacyProducts = await CustomerApi.getPharmacyProducts(allPharmacies[0].id);
          const productsData = Array.isArray(pharmacyProducts) ? pharmacyProducts : (pharmacyProducts as any).products || [];
          
          const formattedProducts: Product[] = productsData.map((prod: any) => {
            const reviewCount = normalizeReviewCount(prod.reviewCount ?? prod.reviews);
            const avgRating = customerFacingRating(
              prod.rating ?? prod.averageRating,
              reviewCount
            );
            return {
            id: prod.id || prod.productId,
            name: prod.name || prod.productName,
            description: prod.description || '',
            price: prod.price || prod.unitPrice || 0,
            originalPrice: prod.originalPrice || prod.mrp,
            rating: avgRating ?? 0,
            reviews: reviewCount,
            image: prod.image || prod.imageUrl || '',
            category: prod.category || 'otc',
            prescriptionRequired: prod.prescriptionRequired || prod.requiresPrescription || false,
            vendorId: prod.vendorId || allPharmacies[0].id,
            vendorName: prod.vendorName || allPharmacies[0].name,
            inStock: prod.inStock !== false && prod.stockQuantity > 0,
          };
          });
          
          setProducts(formattedProducts);
        } else {
          // Fallback: try to get all pharmacy products
          const allProducts = await CustomerApi.getPharmacyProducts();
          const productsData = Array.isArray(allProducts) ? allProducts : (allProducts as any).products || [];
          // Format similar to above
          setProducts([]); // Set empty for now if no products
        }
      } catch (productError) {
        console.warn('Failed to load pharmacy products from API:', productError);
        // Keep empty array on error
        setProducts([]);
      }
    } catch (error) {
      console.error('Error loading pharmacy data:', error);
      Alert.alert('Error', 'Failed to load pharmacy data');
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;
    
    if (activeCategory !== 'all') {
      filtered = filtered.filter(p => p.category === activeCategory);
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

  const getCartItemQuantity = (productId: string) => {
    const item = cart.find(item => item.id === productId);
    return item ? item.quantity : 0;
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
        prescriptionRequired: product.prescriptionRequired,
        vendorId: product.vendorId,
        vendorName: product.vendorName,
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

    // Navigate to checkout screen with cart data
    if (onNavigate) {
      onNavigate('Checkout', { cart, serviceType: 'pharmacy' });
    } else {
      setCurrentView('confirmation');
    }
  };

  const renderLanding = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pet Pharmacy</Text>
        <Text style={styles.subtitle}>Medicines & health products</Text>
      </View>

      <BrandedStackBelowHeader>
      <ScrollView style={styles.landingScroll} contentContainerStyle={styles.landingContent}>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.activePharmacies}+</Text>
            <Text style={styles.statLabel}>Pharmacies</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.orders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {stats.rating !== '—' ? `⭐ ${stats.rating}` : '—'}
            </Text>
            <Text style={styles.statLabel}>Avg Rating</Text>
          </View>
        </View>

        <View style={styles.benefitsSection}>
          <Text style={styles.sectionTitle}>Why Choose Us?</Text>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>💊</Text>
            <Text style={styles.benefitText}>Genuine medicines & products</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>🚚</Text>
            <Text style={styles.benefitText}>Fast home delivery</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>🛡️</Text>
            <Text style={styles.benefitText}>Prescription verification</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>⭐</Text>
            <Text style={styles.benefitText}>Trusted by pet parents</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setCurrentView('store')}
        >
          <Text style={styles.primaryButtonText}>Browse Products</Text>
        </TouchableOpacity>
      </ScrollView>
      </BrandedStackBelowHeader>
    </View>
  );

  const renderStore = () => (
    <View style={styles.container}>
      <View style={styles.storeHeader}>
        <TouchableOpacity onPress={() => setCurrentView('landing')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Pharmacy Store</Text>
          <Text style={styles.headerSubtitle}>Delivering to Home</Text>
        </View>
        <TouchableOpacity
          onPress={() => setCurrentView('cart')}
          style={styles.cartButton}
        >
          <Text style={styles.cartIcon}>🛒</Text>
          {cart.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cart.reduce((sum, item) => sum + item.quantity, 0)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search medicines, products..."
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
              activeCategory === cat.id && styles.categoryChipActive,
            ]}
            onPress={() => setActiveCategory(cat.id)}
          >
            <Text
              style={[
                styles.categoryChipText,
                activeCategory === cat.id && styles.categoryChipTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <ScrollView style={styles.productsContainer}>
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
                  {product.prescriptionRequired && (
                    <View style={styles.rxBadge}>
                      <Text style={styles.rxBadgeText}>RX</Text>
                    </View>
                  )}
                  {product.originalPrice != null &&
                    hasEffectivePriceReduction(product.originalPrice, product.price) && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>
                        {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <Text style={styles.productDescription} numberOfLines={1}>
                    {product.description}
                  </Text>
                  <View style={styles.productRating}>
                    <Text style={styles.ratingIcon}>⭐</Text>
                    <Text style={styles.ratingText}>{product.rating}</Text>
                    <Text style={styles.reviewsText}>({product.reviews})</Text>
                  </View>
                  <View style={styles.productFooter}>
                    <View>
                      <Text style={styles.productPrice}>₹{product.price}</Text>
                      {product.originalPrice != null &&
                        hasEffectivePriceReduction(product.originalPrice, product.price) && (
                        <Text style={styles.originalPrice}>₹{product.originalPrice}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => addToCart(product)}
                    >
                      <Text style={styles.addButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {cart.length > 0 && (
        <View style={styles.floatingCart}>
          <TouchableOpacity
            style={styles.floatingCartButton}
            onPress={() => setCurrentView('cart')}
          >
            <View style={styles.floatingCartInfo}>
              <Text style={styles.floatingCartItems}>
                {cart.reduce((sum, item) => sum + item.quantity, 0)} items
              </Text>
              <Text style={styles.floatingCartTotal}>₹{getCartTotal()}</Text>
            </View>
            <Text style={styles.floatingCartText}>View Cart →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderProductDetail = () => {
    if (!selectedProduct) return null;

    const quantity = getCartItemQuantity(selectedProduct.id);

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentView('store')}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedProduct.name}</Text>
        </View>

        <BrandedStackBelowHeader>
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
              {selectedProduct.originalPrice != null &&
                hasEffectivePriceReduction(selectedProduct.originalPrice, selectedProduct.price) && (
                <Text style={styles.productDetailOriginalPrice}>
                  ₹{selectedProduct.originalPrice}
                </Text>
              )}
            </View>
            {selectedProduct.prescriptionRequired && (
              <View style={styles.prescriptionNotice}>
                <Text style={styles.prescriptionNoticeText}>
                  ⚠️ Prescription Required
                </Text>
              </View>
            )}
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
        </BrandedStackBelowHeader>
      </View>
    );
  };

  const renderCart = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('store')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shopping Cart</Text>
      </View>

      <BrandedStackBelowHeader>
      <ScrollView style={styles.cartContainer}>
        {cart.length === 0 ? (
          <View style={styles.emptyCart}>
            <Text style={styles.emptyCartIcon}>🛒</Text>
            <Text style={styles.emptyCartText}>Your cart is empty</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setCurrentView('store')}
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
      </BrandedStackBelowHeader>
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

      <BrandedStackBelowHeader>
      <ScrollView style={styles.checkoutContainer}>
        <View style={styles.checkoutSection}>
          <Text style={styles.checkoutSectionTitle}>Order Summary</Text>
          {cart.map(item => (
            <View key={item.id} style={styles.checkoutItem}>
              <Text style={styles.checkoutItemName}>{item.name} x{item.quantity}</Text>
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
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Place Order</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </BrandedStackBelowHeader>
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

  if (loading && currentView === 'landing') {
    return (
      <ScreenShell style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={styles.container}>
      {currentView === 'landing' && renderLanding()}
      {currentView === 'store' && renderStore()}
      {currentView === 'product_detail' && renderProductDetail()}
      {currentView === 'cart' && renderCart()}
      {currentView === 'checkout' && renderCheckout()}
      {currentView === 'confirmation' && renderConfirmation()}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    padding: spacing.md,
    backgroundColor: colors.primary,
    paddingBottom: spacing.md + 4,
  },
  landingScroll: {
    flex: 1,
  },
  backButton: {
    fontSize: typography.body,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.white,
  },
  title: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.white,
    opacity: 0.9,
  },
  landingContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  statNumber: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  benefitsSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  benefitIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  benefitText: {
    fontSize: typography.body,
    color: colors.text,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray['200'],
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerSubtitle: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  cartButton: {
    position: 'relative',
  },
  cartIcon: {
    fontSize: 24,
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
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchContainer: {
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  searchInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
    fontSize: typography.body,
  },
  categoriesContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray['200'],
  },
  categoriesContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: '#F9FAFB',
    marginRight: spacing.sm,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
  },
  categoryChipText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: colors.white,
  },
  productsContainer: {
    flex: 1,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.sm,
  },
  productCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    margin: '1%',
    borderWidth: 1,
    borderColor: colors.gray['200'],
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
  rxBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    backgroundColor: '#3B82F6',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  rxBadgeText: {
    color: colors.white,
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
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  productInfo: {
    padding: spacing.sm,
  },
  productName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
    minHeight: 40,
  },
  productDescription: {
    fontSize: typography.caption,
    color: colors.textSecondary,
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
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
  },
  originalPrice: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontSize: typography.h3,
    fontWeight: 'bold',
  },
  floatingCart: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
  },
  floatingCartButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  floatingCartInfo: {
    flexDirection: 'column',
  },
  floatingCartItems: {
    fontSize: typography.caption,
    color: colors.white,
    opacity: 0.9,
  },
  floatingCartTotal: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.white,
  },
  floatingCartText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.white,
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
  prescriptionNotice: {
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  prescriptionNoticeText: {
    fontSize: typography.body,
    color: '#92400E',
    fontWeight: '600',
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
    color: colors.white,
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
    backgroundColor: colors.gray['200'],
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
    borderTopColor: colors.gray['200'],
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
    borderTopColor: colors.gray['200'],
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
    color: colors.white,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
});

