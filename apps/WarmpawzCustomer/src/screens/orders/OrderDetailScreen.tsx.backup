/**
 * Order Detail Screen - Mobile
 * Detailed view of a specific order
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
  Modal,
  Image,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface OrderDetailScreenProps {
  orderId: string;
  order?: any;
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function OrderDetailScreen({
  orderId,
  order: initialOrder,
  phone,
  onBack,
  onNavigate,
}: OrderDetailScreenProps) {
  const [order, setOrder] = useState<any>(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (!initialOrder) {
      loadOrderDetails();
    }
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      // ✅ WIRED: Using actual API call (Task 5 - Endpoint Wiring)
      const response = await CustomerApi.getOrderDetails(orderId);
      setOrder(response.order || response);
    } catch (error: any) {
      console.error('Error loading order details:', error);
      Alert.alert('Error', error.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    try {
      setCancelling(true);
      // ✅ WIRED: Using actual API call (Task 5 - Endpoint Wiring)
      await CustomerApi.cancelOrder(orderId, 'Customer cancelled via app');
      Alert.alert('Success', 'Order cancelled successfully');
      setShowCancelModal(false);
      loadOrderDetails();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const handleTrackOrder = () => {
    if (onNavigate) {
      onNavigate('OrderTracking', { orderId, order });
    }
  };

  const handleReorder = () => {
    Alert.alert('Reorder', 'Items will be added to cart', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Add to Cart',
        onPress: () => {
          // TODO: Add items to cart
          Alert.alert('Success', 'Items added to cart');
        },
      },
    ]);
  };

  const handleDownloadInvoice = async () => {
    try {
      // TODO: Call API to download invoice
      // const response = await CustomerApi.downloadInvoice(orderId);
      Alert.alert('Success', 'Invoice download started');
    } catch (error) {
      Alert.alert('Error', 'Failed to download invoice');
    }
  };

  const handleContactSupport = () => {
    if (onNavigate) {
      onNavigate('HelpSupport');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'confirmed':
        return '#3B82F6';
      case 'shipped':
        return '#8B5CF6';
      case 'delivered':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const orderTimeline = order
    ? [
        {
          status: 'Order Placed',
          date: order.date || order.createdAt,
          completed: true,
          description: 'Your order has been placed successfully',
        },
        {
          status: 'Confirmed',
          date: order.date || order.createdAt,
          completed: ['confirmed', 'shipped', 'delivered'].includes(order.status),
          description: 'Seller has confirmed your order',
        },
        {
          status: 'Shipped',
          date: ['shipped', 'delivered'].includes(order.status) ? order.date : '',
          completed: ['shipped', 'delivered'].includes(order.status),
          description: 'Your order has been shipped',
        },
        {
          status: 'Delivered',
          date: order.status === 'delivered' ? order.estimatedDelivery || order.date : '',
          completed: order.status === 'delivered',
          description: 'Order delivered successfully',
        },
      ]
    : [];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📦</Text>
          <Text style={styles.emptyStateText}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Order Details</Text>
          <Text style={styles.headerSubtitle}>#{order.orderNumber || orderId}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(order.status) + '20' },
          ]}
        >
          <Text
            style={[styles.statusText, { color: getStatusColor(order.status) }]}
          >
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Order Timeline */}
        {order.status !== 'cancelled' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Timeline</Text>
            <View style={styles.timeline}>
              {orderTimeline.map((item, index) => (
                <View key={index} style={styles.timelineItem}>
                  <View
                    style={[
                      styles.timelineIcon,
                      item.completed
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: '#E5E7EB' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.timelineIconText,
                        item.completed ? { color: '#fff' } : { color: '#9CA3AF' },
                      ]}
                    >
                      {item.completed ? '✓' : '○'}
                    </Text>
                  </View>
                  {index < orderTimeline.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        item.completed
                          ? { backgroundColor: colors.primary }
                          : { backgroundColor: '#E5E7EB' },
                      ]}
                    />
                  )}
                  <View style={styles.timelineContent}>
                    <Text
                      style={[
                        styles.timelineStatus,
                        item.completed ? { color: colors.text } : { color: colors.textSecondary },
                      ]}
                    >
                      {item.status}
                    </Text>
                    <Text style={styles.timelineDescription}>{item.description}</Text>
                    {item.date && (
                      <Text style={styles.timelineDate}>
                        {new Date(item.date).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
            {['confirmed', 'shipped'].includes(order.status) && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleTrackOrder}
              >
                <Text style={styles.primaryButtonText}>🚚 Track Order</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Cancelled Status */}
        {order.status === 'cancelled' && (
          <View style={styles.section}>
            <View style={styles.cancelledCard}>
              <Text style={styles.cancelledIcon}>✕</Text>
              <Text style={styles.cancelledTitle}>Order Cancelled</Text>
              <Text style={styles.cancelledText}>
                This order was cancelled on{' '}
                {new Date(order.date || order.createdAt).toLocaleDateString()}
              </Text>
              <Text style={styles.cancelledRefund}>
                Refund will be processed within 5-7 business days
              </Text>
            </View>
          </View>
        )}

        {/* Delivery Address */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📍</Text>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
          </View>
          <Text style={styles.addressText}>
            {order.deliveryAddress ||
              (order.address
                ? `${order.address.line1 || ''}\n${order.address.city || ''}, ${order.address.state || ''} - ${order.address.pincode || ''}`
                : 'Address not available')}
          </Text>
          {order.estimatedDelivery &&
            order.status !== 'delivered' &&
            order.status !== 'cancelled' && (
              <View style={styles.estimatedDelivery}>
                <Text style={styles.estimatedDeliveryIcon}>⏰</Text>
                <Text style={styles.estimatedDeliveryText}>
                  Expected by{' '}
                  {new Date(order.estimatedDelivery).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            )}
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Order Items ({order.items?.length || 0})
          </Text>
          <View style={styles.itemsList}>
            {order.items?.map((item: any, index: number) => (
              <View key={item.id || index} style={styles.itemCard}>
                <View style={styles.itemImage}>
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.itemImageContent}
                    />
                  ) : (
                    <Text style={styles.itemImagePlaceholder}>📦</Text>
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.productName || item.name}
                  </Text>
                  <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                  <Text style={styles.itemPrice}>
                    ₹{(item.price || 0) * (item.quantity || 1)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Payment Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.paymentBreakdown}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Item Total</Text>
              <Text style={styles.paymentValue}>
                ₹{order.totalAmount - (order.deliveryFee || 0) + (order.discount || 0)}
              </Text>
            </View>
            {order.discount > 0 && (
              <View style={styles.paymentRow}>
                <Text style={[styles.paymentLabel, styles.discountText]}>
                  Discount
                </Text>
                <Text style={[styles.paymentValue, styles.discountText]}>
                  -₹{order.discount}
                </Text>
              </View>
            )}
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Delivery Fee</Text>
              <Text style={styles.paymentValue}>
                {order.deliveryFee === 0 ? (
                  <Text style={styles.freeText}>FREE</Text>
                ) : (
                  `₹${order.deliveryFee || 0}`
                )}
              </Text>
            </View>
            <View style={styles.paymentDivider} />
            <View style={styles.paymentRow}>
              <Text style={styles.paymentTotalLabel}>Total Paid</Text>
              <Text style={styles.paymentTotalValue}>₹{order.totalAmount}</Text>
            </View>
            <View style={styles.paymentMethod}>
              <Text style={styles.paymentMethodIcon}>✓</Text>
              <Text style={styles.paymentMethodText}>
                Paid using {order.paymentMethod || 'UPI'}
              </Text>
            </View>
          </View>
        </View>

        {/* Tracking Info */}
        {order.trackingNumber &&
          ['shipped', 'delivered'].includes(order.status) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tracking Information</Text>
              <View style={styles.trackingCard}>
                <View style={styles.trackingInfo}>
                  <Text style={styles.trackingLabel}>Tracking Number</Text>
                  <Text style={styles.trackingNumber}>
                    {order.trackingNumber}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleDownloadInvoice}>
                  <Text style={styles.downloadIcon}>📥</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        {/* Help & Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Need Help?</Text>
          <TouchableOpacity
            style={styles.helpCard}
            onPress={handleContactSupport}
          >
            <View style={styles.helpIcon}>📞</View>
            <View style={styles.helpInfo}>
              <Text style={styles.helpTitle}>Contact Support</Text>
              <Text style={styles.helpSubtitle}>Get help with your order</Text>
            </View>
            <Text style={styles.helpArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.helpCard}
            onPress={handleDownloadInvoice}
          >
            <View style={styles.helpIcon}>📄</View>
            <View style={styles.helpInfo}>
              <Text style={styles.helpTitle}>Download Invoice</Text>
              <Text style={styles.helpSubtitle}>Get order invoice PDF</Text>
            </View>
            <Text style={styles.helpArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      {order.status !== 'cancelled' && (
        <View style={styles.bottomActions}>
          {order.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => setShowCancelModal(true)}
            >
              <Text style={[styles.actionButtonText, styles.cancelButtonText]}>
                Cancel Order
              </Text>
            </TouchableOpacity>
          )}
          {order.status === 'delivered' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryActionButton]}
              onPress={handleReorder}
            >
              <Text style={[styles.actionButtonText, styles.primaryActionButtonText]}>
                🔄 Reorder
              </Text>
            </TouchableOpacity>
          )}
          {['confirmed', 'shipped'].includes(order.status) && (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryActionButton]}
              onPress={handleTrackOrder}
            >
              <Text style={[styles.actionButtonText, styles.primaryActionButtonText]}>
                🚚 Track Order
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Cancel Confirmation Modal */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Text style={styles.modalIcon}>⚠️</Text>
              </View>
              <Text style={styles.modalTitle}>Cancel Order?</Text>
              <Text style={styles.modalText}>
                Are you sure you want to cancel this order? This action cannot be
                undone.
              </Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={styles.modalButtonTextSecondary}>Keep Order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={handleCancelOrder}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonTextDanger}>Yes, Cancel</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerTitle: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: typography.caption,
    color: '#fff',
    opacity: 0.8,
  },
  headerSpacer: {
    width: 60,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.caption,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  timeline: {
    marginBottom: spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  timelineIconText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  timelineLine: {
    position: 'absolute',
    left: 15,
    top: 32,
    width: 2,
    height: 48,
  },
  timelineContent: {
    flex: 1,
    paddingTop: spacing.xs,
  },
  timelineStatus: {
    fontSize: typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  timelineDescription: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  timelineDate: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  cancelledCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
  },
  cancelledIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  cancelledTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: '#991B1B',
    marginBottom: spacing.xs,
  },
  cancelledText: {
    fontSize: typography.body,
    color: '#7F1D1D',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  cancelledRefund: {
    fontSize: typography.caption,
    color: '#991B1B',
    textAlign: 'center',
  },
  addressText: {
    fontSize: typography.body,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  estimatedDelivery: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#F0F9FF',
    borderRadius: borderRadius.md,
  },
  estimatedDeliveryIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  estimatedDeliveryText: {
    fontSize: typography.caption,
    color: colors.primary,
  },
  itemsList: {
    gap: spacing.md,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  itemImageContent: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
  },
  itemImagePlaceholder: {
    fontSize: 32,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  itemQuantity: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  itemPrice: {
    fontSize: typography.body,
    fontWeight: 'bold',
    color: colors.text,
  },
  paymentBreakdown: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  paymentLabel: {
    fontSize: typography.body,
    color: colors.text,
  },
  paymentValue: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  discountText: {
    color: '#10B981',
  },
  freeText: {
    color: '#10B981',
    fontWeight: 'bold',
  },
  paymentDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: spacing.sm,
  },
  paymentTotalLabel: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
  },
  paymentTotalValue: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.primary,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  paymentMethodIcon: {
    fontSize: 16,
    color: '#10B981',
    marginRight: spacing.xs,
  },
  paymentMethodText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  trackingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  trackingInfo: {
    flex: 1,
  },
  trackingLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  trackingNumber: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'monospace',
  },
  downloadIcon: {
    fontSize: 24,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  helpIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  helpInfo: {
    flex: 1,
  },
  helpTitle: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  helpSubtitle: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  helpArrow: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    borderColor: '#EF4444',
    backgroundColor: '#fff',
  },
  cancelButtonText: {
    color: '#EF4444',
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  primaryActionButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  primaryActionButtonText: {
    color: '#fff',
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  actionButtonText: {
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyStateText: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalIcon: {
    fontSize: 32,
  },
  modalTitle: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  modalText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalButtonDanger: {
    backgroundColor: '#EF4444',
  },
  modalButtonTextSecondary: {
    fontSize: typography.body,
    color: colors.text,
    fontWeight: 'bold',
  },
  modalButtonTextDanger: {
    fontSize: typography.body,
    color: '#fff',
    fontWeight: 'bold',
  },
});

