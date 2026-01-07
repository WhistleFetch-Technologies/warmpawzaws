/**
 * Meal Plan Orders Screen - Mobile
 * View and track meal plan delivery orders
 * Full lifecycle: Order → Payment → Tracking → Delivery → Completion
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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface MealPlanOrdersScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface MealPlanOrder {
  id: string;
  order_number: string;
  meal_plan_id?: string;
  meal_plan_name?: string;
  pet_id?: string;
  pet_name?: string;
  quantity: number;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  delivery_date: string;
  delivery_time: string;
  delivery_address?: string;
  created_at: string;
  updated_at?: string;
  payment_status?: string;
}

export function MealPlanOrdersScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
}: MealPlanOrdersScreenProps) {
  const [orders, setOrders] = useState<MealPlanOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all');

  useEffect(() => {
    loadOrders();
  }, [filter]);

  useEffect(() => {
    // Auto-refresh every 30 seconds for active orders
    const interval = setInterval(() => {
      if (filter === 'all' || filter === 'active') {
        loadOrders();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [filter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const finalCustomerId = customerId || (await CustomerApi.getCustomerByPhone(phone))?.id;

      if (!finalCustomerId) {
        Alert.alert('Error', 'Customer not found');
        return;
      }

      const response = await CustomerApi.getOrderHistory(finalCustomerId);
      const allOrders = Array.isArray(response) ? response : response.orders || [];

      // Filter meal plan orders
      const mealPlanOrders = allOrders
        .filter((o: any) => 
          o.order_type === 'meal_plan_delivery' || 
          o.orderType === 'meal_plan_delivery' ||
          o.service_type === 'meal_plan' ||
          (o.items && o.items.some((item: any) => item.item_type === 'meal_plan'))
        )
        .map((o: any) => ({
          id: o.id,
          order_number: o.order_number || o.orderNumber || `MP-${o.id.slice(-8)}`,
          meal_plan_id: o.meal_plan_id || o.mealPlanId,
          meal_plan_name: o.meal_plan_name || o.mealPlanName || o.items?.[0]?.name || 'Meal Plan',
          pet_id: o.pet_id || o.petId,
          pet_name: o.pet_name || o.petName,
          quantity: o.quantity || o.items?.[0]?.quantity || 1,
          total_amount: o.total_amount || o.totalAmount || o.final_amount || 0,
          status: o.status || o.order_status || 'pending',
          delivery_date: o.delivery_date || o.deliveryDate || '',
          delivery_time: o.delivery_time || o.deliveryTime || '',
          delivery_address: o.delivery_address || o.deliveryAddress || o.shipping_address || '',
          created_at: o.created_at || o.createdAt || new Date().toISOString(),
          updated_at: o.updated_at || o.updatedAt,
          payment_status: o.payment_status || o.paymentStatus,
        }));

      // Apply filter
      let filtered = mealPlanOrders;
      if (filter === 'active') {
        filtered = mealPlanOrders.filter((o) => 
          ['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(o.status)
        );
      } else if (filter === 'delivered') {
        filtered = mealPlanOrders.filter((o) => o.status === 'delivered');
      } else if (filter === 'cancelled') {
        filtered = mealPlanOrders.filter((o) => o.status === 'cancelled');
      }

      setOrders(filtered);
    } catch (error: any) {
      console.error('Error loading meal plan orders:', error);
      Alert.alert('Error', error.message || 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return { bg: '#FEF3C7', text: '#92400E', icon: 'clock-outline' };
      case 'confirmed':
        return { bg: '#DBEAFE', text: '#1E40AF', icon: 'check-circle-outline' };
      case 'preparing':
        return { bg: '#E9D5FF', text: '#6B21A8', icon: 'chef-hat' };
      case 'out_for_delivery':
        return { bg: '#FED7AA', text: '#9A3412', icon: 'truck-delivery' };
      case 'delivered':
        return { bg: '#D1FAE5', text: '#065F46', icon: 'check-circle' };
      case 'cancelled':
        return { bg: '#FEE2E2', text: '#991B1B', icon: 'close-circle' };
      default:
        return { bg: '#F3F4F6', text: '#374151', icon: 'help-circle' };
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleOrderPress = (order: MealPlanOrder) => {
    if (onNavigate) {
      onNavigate('OrderDetail', { orderId: order.id, order });
    }
  };

  const handleTrackOrder = (order: MealPlanOrder, e: any) => {
    e.stopPropagation();
    if (onNavigate) {
      onNavigate('OrderTracking', { orderId: order.id, order });
    }
  };

  const renderOrderItem = ({ item }: { item: MealPlanOrder }) => {
    const statusColors = getStatusColor(item.status);
    const isActive = ['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(item.status);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => handleOrderPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderId}>Order #{item.order_number}</Text>
            <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Icon name={statusColors.icon} size={16} color={statusColors.text} />
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.orderContent}>
          <View style={styles.orderDetails}>
            <Text style={styles.mealPlanName} numberOfLines={1}>
              {item.meal_plan_name || 'Meal Plan'}
            </Text>
            {item.pet_name && (
              <View style={styles.petInfo}>
                <Icon name="paw" size={14} color={colors.textSecondary} />
                <Text style={styles.petName}>{item.pet_name}</Text>
              </View>
            )}
            <View style={styles.deliveryInfo}>
              <Icon name="calendar-clock" size={14} color={colors.textSecondary} />
              <Text style={styles.deliveryText}>
                {item.delivery_date ? formatDate(item.delivery_date) : 'Date TBD'} at {item.delivery_time || 'Time TBD'}
              </Text>
            </View>
            {item.delivery_address && (
              <View style={styles.addressInfo}>
                <Icon name="map-marker" size={14} color={colors.textSecondary} />
                <Text style={styles.addressText} numberOfLines={1}>
                  {item.delivery_address}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.orderAmountContainer}>
            <Text style={styles.orderAmount}>₹{item.total_amount.toLocaleString()}</Text>
            <Text style={styles.orderQuantity}>Qty: {item.quantity}</Text>
          </View>
        </View>

        <View style={styles.orderFooter}>
          {isActive && (
            <TouchableOpacity
              style={styles.trackButton}
              onPress={(e) => handleTrackOrder(item, e)}
            >
              <Icon name="map-marker-path" size={16} color={colors.primary} />
              <Text style={styles.trackButtonText}>Track Order</Text>
            </TouchableOpacity>
          )}
          {item.status === 'delivered' && (
            <TouchableOpacity
              style={styles.reorderButton}
              onPress={(e) => {
                e.stopPropagation();
                if (onNavigate) {
                  onNavigate('MealPlanOrderScreen', { vendorId: '' });
                }
              }}
            >
              <Icon name="refresh" size={16} color={colors.primary} />
              <Text style={styles.reorderButtonText}>Reorder</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.viewButton}
            onPress={(e) => {
              e.stopPropagation();
              handleOrderPress(item);
            }}
          >
            <Text style={styles.viewButtonText}>View Details</Text>
            <Icon name="chevron-right" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="food-off" size={64} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>No Meal Plan Orders</Text>
      <Text style={styles.emptyText}>
        {filter === 'all' 
          ? "You haven't placed any meal plan orders yet."
          : `No ${filter} orders found.`}
      </Text>
      {filter === 'all' && (
        <TouchableOpacity
          style={styles.orderButton}
          onPress={() => {
            if (onNavigate) {
              onNavigate('NutritionistServiceScreen');
            }
          }}
        >
          <Text style={styles.orderButtonText}>Order Meal Plan</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meal Plan Orders</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'active', 'delivered', 'cancelled'] as const).map((filterType) => (
          <TouchableOpacity
            key={filterType}
            style={[styles.filterTab, filter === filterType && styles.filterTabActive]}
            onPress={() => setFilter(filterType)}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === filterType && styles.filterTabTextActive,
              ]}
            >
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={orders.length === 0 ? styles.emptyListContainer : styles.listContainer}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          showsVerticalScrollIndicator={false}
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
  headerTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.xs / 2,
  },
  filterTabActive: {
    backgroundColor: colors.primary + '20',
  },
  filterTabText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  filterTabTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeights.bold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  listContainer: {
    padding: spacing.md,
  },
  emptyListContainer: {
    flex: 1,
  },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  orderDate: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs / 2,
  },
  statusText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  orderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  orderDetails: {
    flex: 1,
    marginRight: spacing.sm,
  },
  mealPlanName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  petInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    marginBottom: spacing.xs / 2,
  },
  petName: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    marginBottom: spacing.xs / 2,
  },
  deliveryText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  addressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  addressText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    flex: 1,
  },
  orderAmountContainer: {
    alignItems: 'flex-end',
  },
  orderAmount: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.xs / 2,
  },
  orderQuantity: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  orderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary + '10',
    gap: spacing.xs / 2,
  },
  trackButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary + '10',
    gap: spacing.xs / 2,
  },
  reorderButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  viewButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  orderButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  orderButtonText: {
    color: colors.white,
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
  },
});

