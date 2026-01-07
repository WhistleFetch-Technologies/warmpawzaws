/**
 * Order Success Screen - Mobile
 * Order confirmation after successful checkout
 * Identical functionality to web app
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';

interface OrderSuccessScreenProps {
  orderId: string;
  order?: any;
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function OrderSuccessScreen({
  orderId,
  order,
  phone,
  onBack,
  onNavigate,
}: OrderSuccessScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Success Icon */}
        <View style={styles.successIconContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
        </View>

        {/* Success Message */}
        <Text style={styles.successTitle}>Order Placed Successfully!</Text>
        <Text style={styles.successSubtitle}>
          Your order has been confirmed and will be delivered soon.
        </Text>

        {/* Order Details */}
        <View style={styles.orderDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Order ID</Text>
            <Text style={styles.detailValue}>#{orderId}</Text>
          </View>
          {order?.totalAmount && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Amount</Text>
              <Text style={styles.detailValue}>₹{order.totalAmount.toLocaleString()}</Text>
            </View>
          )}
          {order?.estimatedDelivery && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estimated Delivery</Text>
              <Text style={styles.detailValue}>
                {new Date(order.estimatedDelivery).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.trackOrderButton}
            onPress={() => onNavigate && onNavigate('OrderTracking', { orderId })}
          >
            <Text style={styles.trackOrderButtonText}>Track Order</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.viewOrderButton}
            onPress={() => onNavigate && onNavigate('OrderDetail', { orderId, order })}
          >
            <Text style={styles.viewOrderButtonText}>View Order Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.continueShoppingButton}
            onPress={() => onNavigate && onNavigate('ShopDashboard')}
          >
            <Text style={styles.continueShoppingButtonText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  successIconContainer: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#16a34a',
  },
  checkIcon: {
    fontSize: 48,
    color: '#16a34a',
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  orderDetails: {
    width: '100%',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  actions: {
    width: '100%',
    gap: spacing.md,
  },
  trackOrderButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  trackOrderButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  viewOrderButton: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewOrderButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  continueShoppingButton: {
    backgroundColor: colors.gray.100,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  continueShoppingButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});

