/**
 * Wishlist Screen - Mobile
 * Manage product wishlist
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface WishlistScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface WishlistItem {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  price: number;
  originalPrice?: number;
  inStock: boolean;
  addedAt: string;
}

export function WishlistScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
}: WishlistScreenProps) {
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWishlist();
  }, []);

  const loadWishlist = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getWishlist(customerId || phone);
      const items = Array.isArray(response) ? response : response.wishlist || [];
      setWishlist(items);
    } catch (error) {
      console.error('Error loading wishlist:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWishlist();
  };

  const handleRemove = (itemId: string) => {
    Alert.alert(
      'Remove from Wishlist',
      'Are you sure you want to remove this item from your wishlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await CustomerApi.removeFromWishlist(itemId);
              setWishlist(wishlist.filter(item => item.id !== itemId));
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove item');
            }
          },
        },
      ]
    );
  };

  const handleAddToCart = (item: WishlistItem) => {
    if (onNavigate) {
      onNavigate('ShoppingCart', { 
        addProduct: { 
          id: item.productId, 
          name: item.productName,
          price: item.price 
        } 
      });
    }
  };

  const renderWishlistItem = ({ item }: { item: WishlistItem }) => (
    <View style={styles.wishlistCard}>
      <TouchableOpacity
        style={styles.productInfo}
        onPress={() => onNavigate && onNavigate('ProductDetail', { productId: item.productId })}
      >
        <View style={styles.productImage}>
          <Text style={styles.productImagePlaceholder}>🛍️</Text>
        </View>
        <View style={styles.productDetails}>
          <Text style={styles.productName}>{item.productName}</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>₹{item.price.toLocaleString()}</Text>
            {item.originalPrice && item.originalPrice > item.price && (
              <Text style={styles.originalPrice}>₹{item.originalPrice.toLocaleString()}</Text>
            )}
          </View>
          {!item.inStock && (
            <Text style={styles.outOfStock}>Out of Stock</Text>
          )}
        </View>
      </TouchableOpacity>
      <View style={styles.actions}>
        {item.inStock && (
          <TouchableOpacity
            style={styles.addToCartButton}
            onPress={() => handleAddToCart(item)}
          >
            <Text style={styles.addToCartButtonText}>Add to Cart</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemove(item.id)}
        >
          <Text style={styles.removeButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && wishlist.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wishlist</Text>
        <View style={styles.placeholder} />
      </View>

      {wishlist.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>❤️</Text>
          <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Add products to your wishlist to save them for later
          </Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => onNavigate && onNavigate('ShopDashboard')}
          >
            <Text style={styles.shopButtonText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={wishlist}
          renderItem={renderWishlistItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
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
  listContent: {
    padding: spacing.md,
  },
  wishlistCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
  },
  productInfo: {
    flex: 1,
    flexDirection: 'row',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray['100'],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  productImagePlaceholder: {
    fontSize: 32,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  originalPrice: {
    fontSize: 14,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  outOfStock: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '600',
  },
  actions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: spacing.md,
  },
  addToCartButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  addToCartButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    padding: spacing.sm,
  },
  removeButtonText: {
    fontSize: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  shopButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  shopButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

