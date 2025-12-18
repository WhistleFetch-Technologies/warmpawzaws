/**
 * Meal Delivery Tracking Screen - Customer Mobile App
 * Track meal delivery in real-time
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { API_BASE_URL, getPublicAnonKey } from '../../config/api';
import ErrorHandler from '../../utils/errorHandler';

interface DeliveryStatus {
  status: 'pending' | 'preparing' | 'dispatched' | 'in_transit' | 'delivered';
  timestamp: string;
  message: string;
}

interface DeliveryPartner {
  name: string;
  phone: string;
  vehicleNumber?: string;
}

export default function MealDeliveryTrackingScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { orderId } = route.params as { orderId: string };

  const [order, setOrder] = useState<any>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus[]>([]);
  const [deliveryPartner, setDeliveryPartner] = useState<DeliveryPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );

  useEffect(() => {
    loadOrderDetails();
    const interval = setInterval(() => {
      loadOrderDetails();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/nutritionist/meal-order/${orderId}`, {
        headers: {
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrder(data.order);
        setDeliveryStatus(data.deliveryStatus || []);
        setDeliveryPartner(data.deliveryPartner || null);
        setCurrentLocation(data.currentLocation || null);
      } else {
        const error = await response.json();
        ErrorHandler.showError(error);
      }
    } catch (error) {
      ErrorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'check-circle';
      case 'in_transit':
        return 'local-shipping';
      case 'dispatched':
        return 'local-shipping';
      case 'preparing':
        return 'restaurant';
      default:
        return 'schedule';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return '#4CAF50';
      case 'in_transit':
        return BrandColors.primary.orange;
      case 'dispatched':
        return BrandColors.primary.orange;
      case 'preparing':
        return '#2196F3';
      default:
        return BrandColors.text.secondary;
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={64} color={BrandColors.text.secondary} />
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  const currentStatus = deliveryStatus[deliveryStatus.length - 1]?.status || 'pending';

  return (
    <ScrollView style={styles.container}>
      {/* Order Info */}
      <View style={styles.orderInfoCard}>
        <Text style={styles.orderId}>Order #{order.orderNumber || orderId}</Text>
        <Text style={styles.orderDate}>
          Placed on {new Date(order.createdAt).toLocaleDateString()}
        </Text>
        <View style={styles.statusBadge}>
          <Icon name={getStatusIcon(currentStatus)} size={20} color={getStatusColor(currentStatus)} />
          <Text style={[styles.statusText, { color: getStatusColor(currentStatus) }]}>
            {currentStatus.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Delivery Partner Info */}
      {deliveryPartner && (
        <View style={styles.partnerCard}>
          <Text style={styles.sectionTitle}>Delivery Partner</Text>
          <View style={styles.partnerInfo}>
            <Icon name="person" size={24} color={BrandColors.primary.orange} />
            <View style={styles.partnerDetails}>
              <Text style={styles.partnerName}>{deliveryPartner.name}</Text>
              {deliveryPartner.phone && (
                <Text style={styles.partnerPhone}>{deliveryPartner.phone}</Text>
              )}
              {deliveryPartner.vehicleNumber && (
                <Text style={styles.partnerVehicle}>{deliveryPartner.vehicleNumber}</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.callButton}
              onPress={() => {
                // Handle call
              }}
            >
              <Icon name="phone" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Delivery Status Timeline */}
      <View style={styles.timelineCard}>
        <Text style={styles.sectionTitle}>Delivery Status</Text>
        {deliveryStatus.map((status, index) => (
          <View key={index} style={styles.timelineItem}>
            <View style={styles.timelineIcon}>
              <Icon
                name={getStatusIcon(status.status)}
                size={20}
                color={getStatusColor(status.status)}
              />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineStatus}>
                {status.status.replace('_', ' ').toUpperCase()}
              </Text>
              <Text style={styles.timelineMessage}>{status.message}</Text>
              <Text style={styles.timelineTime}>
                {new Date(status.timestamp).toLocaleString()}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Delivery Address */}
      {order.deliveryAddress && (
        <View style={styles.addressCard}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <Text style={styles.addressText}>{order.deliveryAddress.address}</Text>
          <Text style={styles.addressDetails}>
            {order.deliveryAddress.city}, {order.deliveryAddress.state} -{' '}
            {order.deliveryAddress.pincode}
          </Text>
        </View>
      )}

      {/* Order Items */}
      <View style={styles.itemsCard}>
        <Text style={styles.sectionTitle}>Order Items</Text>
        {order.items?.map((item: any, index: number) => (
          <View key={index} style={styles.itemRow}>
            <Text style={styles.itemName}>{item.name || item.mealName}</Text>
            <Text style={styles.itemQuantity}>x{item.quantity}</Text>
            <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>₹{order.totalAmount}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.secondary,
    marginTop: Spacing.md,
  },
  orderInfoCard: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  orderId: {
    ...Typography.headingMedium,
    color: BrandColors.text.primary,
    marginBottom: Spacing.xs,
  },
  orderDate: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
    marginBottom: Spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F5F5F5',
  },
  statusText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    marginLeft: Spacing.xs,
  },
  partnerCard: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginBottom: Spacing.md,
  },
  partnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerDetails: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  partnerName: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  partnerPhone: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
    marginBottom: 2,
  },
  partnerVehicle: {
    ...Typography.bodyTiny,
    color: BrandColors.text.secondary,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineCard: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStatus: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  timelineMessage: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
    marginBottom: Spacing.xs,
  },
  timelineTime: {
    ...Typography.bodyTiny,
    color: BrandColors.text.secondary,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  addressText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    marginBottom: Spacing.xs,
  },
  addressDetails: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
  },
  itemsCard: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  itemName: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    flex: 1,
  },
  itemQuantity: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
    marginHorizontal: Spacing.md,
  },
  itemPrice: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  totalLabel: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
  },
  totalAmount: {
    ...Typography.headingSmall,
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
});

