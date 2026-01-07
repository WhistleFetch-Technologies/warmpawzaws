/**
 * Order History Screen - Mobile
 * View order history with filters
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
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface OrderHistoryScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface Order {
  id: string;
  orderId: string;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
  createdAt: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

export function OrderHistoryScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
}: OrderHistoryScreenProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'delivered' | 'cancelled'>('all');

  useEffect(() => {
    loadOrders();
  }, [filter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      // Use getOrderHistory if customerId available, otherwise fallback to phone-based endpoint
      const response = customerId 
        ? await CustomerApi.getOrderHistory(customerId)
        : await CustomerApi.getOrders(phone);
      const ordersData = Array.isArray(response) ? response : response.orders || [];
      
      let filtered = ordersData;
      if (filter === 'pending') {
        filtered = ordersData.filter((o: Order) => 
          ['pending', 'confirmed', 'processing', 'shipped'].includes(o.status)
        );
      } else if (filter === 'delivered') {
        filtered = ordersData.filter((o: Order) => o.status === 'delivered');
      } else if (filter === 'cancelled') {
        filtered = ordersData.filter((o: Order) => 
          ['cancelled', 'returned'].includes(o.status)
        );
      }
      
      setOrders(filtered);
    } catch (error) {
      console.error('Error loading orders:', error);
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
    switch (status) {
      case 'delivered':
        return colors.success;
      case 'cancelled':
      case 'returned':
        return colors.error;
      case 'pending':
      case 'confirmed':
      case 'processing':
      case 'shipped':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderOrderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => onNavigate && onNavigate('OrderDetail', { orderId: item.id })}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderId}>Order #{item.orderId}</Text>
          <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      {item.items && item.items.length > 0 && (
        <View style={styles.orderItems}>
          <Text style={styles.orderItemsText} numberOfLines={2}>
            {item.items.map(i => i.name).join(', ')}
          </Text>
          {item.items.length > 1 && (
            <Text style={styles.orderItemsCount}>
              +{item.items.length - 1} more items
            </Text>
          )}
        </View>
      )}
      <View style={styles.orderFooter}>
        <Text style={styles.orderAmount}>₹{item.totalAmount.toLocaleString()}</Text>
        <View style={styles.orderActions}>
          {item.status === 'delivered' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onNavigate && onNavigate('OrderReturn', { orderId: item.id })}
            >
              <Text style={styles.actionButtonText}>Return</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onNavigate && onNavigate('OrderDetail', { orderId: item.id })}
          >
            <Text style={styles.actionButtonText}>View</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading && orders.length === 0) {
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
        <Text style={styles.headerTitle}>Order History</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {(['all', 'pending', 'delivered', 'cancelled'] as const).map((filterOption) => (
          <TouchableOpacity
            key={filterOption}
            style={[
              styles.filterButton,
              filter === filterOption && styles.filterButtonActive,
            ]}
            onPress={() => setFilter(filterOption)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filter === filterOption && styles.filterButtonTextActive,
              ]}
            >
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Orders List */}
      {orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No Orders</Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'all'
              ? 'You have no orders yet'
              : `You have no ${filter} orders`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
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
  filters: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray.100,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: colors.white,
  },
  listContent: {
    padding: spacing.md,
  },
  orderCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  orderDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  orderItems: {
    marginBottom: spacing.sm,
  },
  orderItemsText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  orderItemsCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  orderActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gray.100,
  },
  actionButtonText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
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
  },
});
