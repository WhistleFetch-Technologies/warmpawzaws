/**
 * Nutritionist Menu Screen - Customer Mobile App
 * Browse nutritionist menu and order meals
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import NutritionistService, { MealItem } from '../../services/NutritionistService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface NutritionistMenuScreenProps {
  route?: {
    params?: {
      nutritionistId: string;
      nutritionistName: string;
    };
  };
  navigation?: any;
}

export default function NutritionistMenuScreen({
  route,
  navigation,
}: NutritionistMenuScreenProps) {
  const nutritionistId = route?.params?.nutritionistId || '';
  const nutritionistName = route?.params?.nutritionistName || '';

  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState<MealItem[]>([]);
  const [cart, setCart] = useState<Array<{ item: MealItem; quantity: number }>>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadMenu();
  }, [nutritionistId]);

  const loadMenu = async () => {
    try {
      setLoading(true);
      const menuItems = await NutritionistService.getMenu(nutritionistId);
      setMenu(menuItems);
    } catch (error) {
      console.error('Error loading menu:', error);
      Alert.alert('Error', 'Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (item: MealItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.itemId === item.itemId);
      if (existing) {
        return prev.map((c) =>
          c.item.itemId === item.itemId ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.itemId === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map((c) =>
          c.item.itemId === itemId ? { ...c, quantity: c.quantity - 1 } : c
        );
      }
      return prev.filter((c) => c.item.itemId !== itemId);
    });
  };

  const getCartQuantity = (itemId: string) => {
    const cartItem = cart.find((c) => c.item.itemId === itemId);
    return cartItem?.quantity || 0;
  };

  const filteredMenu = menu.filter((item) => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  const totalAmount = cart.reduce((sum, cartItem) => sum + cartItem.item.price * cartItem.quantity, 0);

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to cart');
      return;
    }
    navigation?.navigate('NutritionistOrder', {
      nutritionistId,
      items: cart,
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading menu...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[Typography.h2, styles.headerTitle]}>{nutritionistName}</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>Menu</Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { key: 'all', label: 'All' },
              { key: 'fresh', label: 'Fresh' },
              { key: 'frozen', label: 'Frozen' },
              { key: 'dry', label: 'Dry' },
              { key: 'treat', label: 'Treats' },
            ].map((filterOption) => (
              <TouchableOpacity
                key={filterOption.key}
                style={[
                  styles.filterButton,
                  filter === filterOption.key && styles.filterButtonActive,
                ]}
                onPress={() => setFilter(filterOption.key)}
              >
                <Text
                  style={[
                    Typography.bodySmall,
                    filter === filterOption.key && styles.filterButtonTextActive,
                  ]}
                >
                  {filterOption.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Menu Items */}
        {filteredMenu.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="restaurant-menu" size={64} color={BrandColors.neutral.gray300} />
            <Text style={[Typography.body, styles.emptyText]}>No items available</Text>
          </View>
        ) : (
          <View style={styles.menuList}>
            {filteredMenu.map((item) => {
              const quantity = getCartQuantity(item.itemId);
              return (
                <View key={item.itemId} style={styles.menuItem}>
                  {item.images && item.images.length > 0 && (
                    <Image
                      source={{ uri: item.images[0] }}
                      style={styles.itemImage}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.itemContent}>
                    <View style={styles.itemHeader}>
                      <View style={styles.itemInfo}>
                        <Text style={[Typography.h4, styles.itemName]}>{item.name}</Text>
                        <Text style={[Typography.bodySmall, styles.itemDescription]} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </View>
                      <Text style={[Typography.h4, styles.itemPrice]}>₹{item.price}</Text>
                    </View>

                    {item.dietaryTags && item.dietaryTags.length > 0 && (
                      <View style={styles.tagsRow}>
                        {item.dietaryTags.map((tag, index) => (
                          <View key={index} style={styles.tagBadge}>
                            <Text style={[Typography.bodyTiny, styles.tagText]}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {item.nutritionalInfo && (
                      <View style={styles.nutritionRow}>
                        <Text style={[Typography.bodyTiny, styles.nutritionText]}>
                          {item.nutritionalInfo.calories} cal
                        </Text>
                        <Text style={[Typography.bodyTiny, styles.nutritionText]}>
                          Protein: {item.nutritionalInfo.protein}
                        </Text>
                      </View>
                    )}

                    <View style={styles.itemActions}>
                      {quantity > 0 ? (
                        <View style={styles.quantityControls}>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => removeFromCart(item.itemId)}
                          >
                            <Icon name="remove" size={20} color={BrandColors.primary.orange} />
                          </TouchableOpacity>
                          <Text style={[Typography.body, styles.quantityValue]}>{quantity}</Text>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => addToCart(item)}
                          >
                            <Icon name="add" size={20} color={BrandColors.primary.orange} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.addButton}
                          onPress={() => addToCart(item)}
                          disabled={!item.isAvailable}
                        >
                          <Text
                            style={[
                              Typography.bodySmall,
                              styles.addButtonText,
                              !item.isAvailable && styles.addButtonTextDisabled,
                            ]}
                          >
                            {item.isAvailable ? 'Add to Cart' : 'Unavailable'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Cart Footer */}
      {cart.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.cartSummary}>
            <View style={styles.cartInfo}>
              <Text style={[Typography.body, styles.cartItems]}>{cart.length} items</Text>
              <Text style={[Typography.h4, styles.cartTotal]}>₹{totalAmount.toLocaleString()}</Text>
            </View>
            <BrandedButton
              title="View Cart"
              onPress={handleCheckout}
              variant="primary"
              fullWidth
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl + 100,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    color: BrandColors.neutral.gray600,
  },
  filtersContainer: {
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  filterButton: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.neutral.gray100,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    marginLeft: Spacing.base,
  },
  filterButtonActive: {
    backgroundColor: BrandColors.primary.orange,
    borderColor: BrandColors.primary.orange,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    minHeight: 400,
  },
  emptyText: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.base,
  },
  menuList: {
    padding: Spacing.lg,
    gap: Spacing.base,
  },
  menuItem: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  itemImage: {
    width: '100%',
    height: 150,
    backgroundColor: BrandColors.neutral.gray200,
  },
  itemContent: {
    padding: Spacing.base,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  itemDescription: {
    color: BrandColors.neutral.gray600,
  },
  itemPrice: {
    color: BrandColors.primary.orange,
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  tagBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: BrandColors.primary.orange + '20',
    borderRadius: BorderRadius.sm,
  },
  tagText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  nutritionRow: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginBottom: Spacing.sm,
  },
  nutritionText: {
    color: BrandColors.neutral.gray600,
  },
  itemActions: {
    marginTop: Spacing.sm,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.base,
    padding: Spacing.sm,
    backgroundColor: BrandColors.primary.orange + '10',
    borderRadius: BorderRadius.md,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.primary.orange + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: {
    color: BrandColors.neutral.gray900,
    minWidth: 30,
    textAlign: 'center',
    fontWeight: '600',
  },
  addButton: {
    padding: Spacing.sm,
    backgroundColor: BrandColors.primary.orange,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  addButtonTextDisabled: {
    color: BrandColors.neutral.gray400,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
    backgroundColor: '#FFFFFF',
  },
  cartSummary: {
    gap: Spacing.base,
  },
  cartInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartItems: {
    color: BrandColors.neutral.gray700,
  },
  cartTotal: {
    color: BrandColors.primary.orange,
    fontWeight: '700',
  },
});
