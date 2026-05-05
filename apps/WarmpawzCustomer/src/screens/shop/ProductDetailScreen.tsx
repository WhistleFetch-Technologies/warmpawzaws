/**
 * Product Detail Screen - Mobile
 * Standalone product detail page
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
  Image,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { starRatingOrUndefined, formatRatingOrDash } from '../../utils/vendor-rating';

interface ProductDetailScreenProps {
  productId: string;
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  rating?: number;
  reviews: number;
  images: string[];
  category: string;
  vendor: {
    name: string;
    rating?: number;
    location: string;
  };
  stock: string;
  specifications?: Record<string, string>;
}

const CART_STORAGE_KEY = 'warmpawz_cart';

export function ProductDetailScreen({
  productId,
  phone,
  onBack,
  onNavigate,
}: ProductDetailScreenProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      // Load product details from API
      const response = await CustomerApi.getProductDetails(productId);
      const prod = response.product || response;
      
      const formattedProduct: Product = {
        id: prod.id || prod.productId,
        name: prod.name || prod.productName,
        description: prod.description || '',
        price: prod.price || prod.unitPrice || 0,
        originalPrice: prod.originalPrice || prod.mrp,
        rating: starRatingOrUndefined(prod.rating ?? prod.averageRating),
        reviews: prod.reviewCount || prod.reviews || 0,
        images: prod.images || (prod.image ? [prod.image] : []) || (prod.imageUrl ? [prod.imageUrl] : []),
        category: prod.category || 'general',
        vendor: {
          name: prod.vendorName || 'Vendor',
          rating: starRatingOrUndefined(prod.vendorRating),
          location: prod.vendorLocation || '',
        },
        stock: prod.inStock ? 'In Stock' : 'Out of Stock',
        specifications: prod.specifications || prod.details || {},
      };
      setProduct(formattedProduct);
    } catch (error) {
      console.error('Error loading product:', error);
      Alert.alert('Error', 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async () => {
    if (!product) return;

    try {
      const cartData = await AsyncStorage.getItem(CART_STORAGE_KEY);
      const cart = cartData ? JSON.parse(cartData) : [];
      
      const existingItem = cart.find((item: any) => item.id === product.id);
      
      if (existingItem) {
        const updatedCart = cart.map((item: any) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updatedCart));
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.images[0],
          quantity,
        });
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      }

      Alert.alert('Success', 'Product added to cart', [
        {
          text: 'Continue Shopping',
          style: 'cancel',
        },
        {
          text: 'View Cart',
          onPress: () => onNavigate && onNavigate('ShoppingCart'),
        },
      ]);
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add product to cart');
    }
  };

  const buyNow = () => {
    if (!product) return;
    if (onNavigate) {
      onNavigate('Checkout', {
        cart: [{
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.images[0],
          quantity,
        }],
      });
    }
  };

  if (loading) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenShell>
    );
  }

  if (!product) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Product not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScreenShell>
    );
  }

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <ScreenShell style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: product.images[selectedImage] }} style={styles.mainImage} />
          {product.images.length > 1 && (
            <ScrollView horizontal style={styles.thumbnailContainer}>
              {product.images.map((image, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedImage(index)}
                  style={[
                    styles.thumbnail,
                    selectedImage === index && styles.thumbnailSelected,
                  ]}
                >
                  <Image source={{ uri: image }} style={styles.thumbnailImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          
          <View style={styles.priceContainer}>
            <Text style={styles.price}>₹{product.price.toLocaleString()}</Text>
            {product.originalPrice && (
              <>
                <Text style={styles.originalPrice}>₹{product.originalPrice.toLocaleString()}</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{discount}% OFF</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.ratingContainer}>
            <Text style={styles.ratingIcon}>⭐</Text>
            <Text style={styles.rating}>{formatRatingOrDash(product.rating)}</Text>
            <Text style={styles.reviews}>({product.reviews} reviews)</Text>
          </View>

          <View style={styles.vendorInfo}>
            <Text style={styles.vendorLabel}>Sold by</Text>
            <Text style={styles.vendorName}>{product.vendor.name}</Text>
            <Text style={styles.vendorRating}>⭐ {formatRatingOrDash(product.vendor.rating)}</Text>
          </View>

          <View style={styles.stockBadge}>
            <Text style={styles.stockText}>{product.stock}</Text>
          </View>
        </View>

        {/* Quantity Selector */}
        <View style={styles.quantitySection}>
          <Text style={styles.quantityLabel}>Quantity</Text>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity(Math.max(1, quantity - 1))}
            >
              <Text style={styles.quantityButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity(quantity + 1)}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description}</Text>
        </View>

        {/* Specifications */}
        {product.specifications && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Specifications</Text>
            {Object.entries(product.specifications).map(([key, value]) => (
              <View key={key} style={styles.specRow}>
                <Text style={styles.specLabel}>{key}</Text>
                <Text style={styles.specValue}>{value}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.addToCartButton} onPress={addToCart}>
          <Text style={styles.addToCartButtonText}>Add to Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buyNowButton} onPress={buyNow}>
          <Text style={styles.buyNowButtonText}>Buy Now</Text>
        </TouchableOpacity>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholder: {
    width: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    backgroundColor: colors.white,
  },
  mainImage: {
    width: '100%',
    height: 400,
    resizeMode: 'cover',
  },
  thumbnailContainer: {
    padding: spacing.sm,
  },
  thumbnail: {
    width: 60,
    height: 60,
    marginRight: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  thumbnailSelected: {
    borderColor: colors.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  productInfo: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginRight: spacing.sm,
  },
  originalPrice: {
    fontSize: 18,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
    marginRight: spacing.sm,
  },
  discountBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  discountText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ratingIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginRight: spacing.xs,
  },
  reviews: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  vendorLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  vendorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginRight: spacing.sm,
  },
  vendorRating: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  stockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  stockText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '600',
  },
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginHorizontal: spacing.md,
    minWidth: 40,
    textAlign: 'center',
  },
  section: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray['100'],
  },
  specLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  specValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  addToCartButton: {
    flex: 1,
    backgroundColor: colors.gray['100'],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  addToCartButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  buyNowButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  buyNowButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

