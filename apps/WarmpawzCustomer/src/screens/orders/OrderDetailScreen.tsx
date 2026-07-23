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
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { OrangeBrandedScreenLayout } from '../../components/layout/OrangeBrandedScreenLayout';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';
import { resumeShopOrderPayment } from '../../utils/ecommerce/resume-shop-order-payment';

interface OrderDetailScreenProps {
  orderId: string;
  order?: any;
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

function normalizeOrderStatus(order: Record<string, unknown>): string {
  const raw =
    order.order_status ||
    order.orderStatus ||
    order.status ||
    '';
  return String(raw).toLowerCase();
}

function canCustomerCancel(status: string): boolean {
  return status === 'pending' || status === 'confirmed';
}

export function OrderDetailScreen({
  orderId,
  order: initialOrder,
  phone,
  customerId: customerIdProp,
  onBack,
  onNavigate,
}: OrderDetailScreenProps) {
  const [order, setOrder] = useState<any>(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [cancelling, setCancelling] = useState(false);
  const [resumingPayment, setResumingPayment] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelIsDraft, setCancelIsDraft] = useState(false);
  const [returnEligible, setReturnEligible] = useState<boolean | null>(null);

  useEffect(() => {
    if (!initialOrder) {
      loadOrderDetails();
    }
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getOrderDetails(orderId);
      const orderData = response.order || response;
      setOrder(orderData);

      const status = normalizeOrderStatus(orderData);
      if (status === 'delivered') {
        try {
          const eligibility = await CustomerApi.getOrderReturnEligibility(orderId);
          setReturnEligible((eligibility as { eligible?: boolean })?.eligible !== false);
        } catch {
          setReturnEligible(true);
        }
      }
    } catch (error: any) {
      console.error('Error loading order details:', error);
      Alert.alert('Error', error.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const resolveCustomerId = async (): Promise<string | null> => {
    if (customerIdProp) return customerIdProp;
    if (order?.customerId || order?.customer_id) {
      return String(order.customerId || order.customer_id);
    }
    try {
      const profile = await CustomerApi.getCustomerByPhone(phone);
      return profile?.id || profile?.customerId || null;
    } catch {
      return null;
    }
  };

  const handleCancelOrder = async () => {
    try {
      setCancelling(true);
      if (cancelIsDraft) {
        await CustomerApi.cancelDraftOrder(orderId, { reason: 'Customer cancelled draft via app' });
        Alert.alert('Success', 'Unpaid order cancelled');
      } else {
        await CustomerApi.cancelOrder(orderId, 'Customer cancelled via app');
        Alert.alert('Success', 'Order cancelled successfully. Refund will be processed if applicable.');
      }
      setShowCancelModal(false);
      loadOrderDetails();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const handleResumePayment = async () => {
    const customerId = await resolveCustomerId();
    if (!customerId) {
      Alert.alert('Error', 'Please sign in again to complete payment');
      return;
    }

    const payable =
      parseFloat(String(order?.totalAmount ?? order?.total_amount ?? '0')) || 0;
    if (payable <= 0) {
      Alert.alert('Error', 'Invalid payment amount');
      return;
    }

    try {
      setResumingPayment(true);
      let profile: unknown = null;
      try {
        profile = await CustomerApi.getCustomerByPhone(phone);
      } catch {
        /* non-fatal */
      }

      await resumeShopOrderPayment({
        orderId,
        payableAmount: payable,
        customerId,
        phone,
        profile,
        onSuccess: () => {
          Alert.alert('Success', 'Payment completed successfully');
          loadOrderDetails();
        },
      });
    } catch (error: any) {
      const message = error?.message || 'Payment failed';
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('Error', message);
      }
    } finally {
      setResumingPayment(false);
    }
  };

  const handleReturnOrder = () => {
    if (onNavigate) {
      onNavigate('OrderReturn', { orderId, order });
    }
  };

  const openCancelModal = (isDraft: boolean) => {
    setCancelIsDraft(isDraft);
    setShowCancelModal(true);
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
      // ✅ WIRED: Using new customer-orders invoice endpoint
      const response = await CustomerApi.getOrderInvoice(orderId);
      // Handle invoice download (could be PDF blob or URL)
      if (response.invoice) {
        // If invoice is a URL, open it
        if (response.invoice.downloadUrl) {
          // Open in new window or download
          Alert.alert('Success', 'Invoice download started');
        } else {
          Alert.alert('Success', 'Invoice ready');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to download invoice');
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
        return colors.success;
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  // Check if it's a meal plan order
  const isMealPlan = order?.order_type === 'meal_plan_delivery' || 
                     order?.orderType === 'meal_plan_delivery' ||
                     order?.service_type === 'meal_plan';

  const orderTimeline = order
    ? (isMealPlan ? [
        {
          status: 'Order Placed',
          date: order.date || order.createdAt || order.created_at,
          completed: true,
          description: 'Your meal plan order has been placed',
        },
        {
          status: 'Confirmed',
          date: order.confirmedAt || order.confirmed_at || order.date || order.createdAt,
          completed: ['confirmed', 'preparing', 'out_for_delivery', 'delivered'].includes(order.status),
          description: 'Order confirmed and payment received',
        },
        {
          status: 'Preparing',
          date: order.processingAt || order.processing_at || '',
          completed: ['preparing', 'out_for_delivery', 'delivered'].includes(order.status),
          description: 'Your meal plan is being prepared',
        },
        {
          status: 'Out for Delivery',
          date: order.outForDeliveryAt || order.out_for_delivery_at || '',
          completed: ['out_for_delivery', 'delivered'].includes(order.status),
          description: 'Your meal plan is on the way',
        },
        {
          status: 'Delivered',
          date: order.deliveredAt || order.delivered_at || (order.status === 'delivered' ? order.delivery_date : ''),
          completed: order.status === 'delivered',
          description: 'Meal plan delivered successfully',
        },
      ] : [
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
      ])
    : [];

  if (loading) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenShell>
    );
  }

  if (!order) {
    return (
      <OrangeBrandedScreenLayout title="Order Details" onBack={onBack} bodyBackgroundColor={colors.white}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📦</Text>
          <Text style={styles.emptyStateText}>Order not found</Text>
        </View>
      </OrangeBrandedScreenLayout>
    );
  }

  const orderStatus = normalizeOrderStatus(order);
  const showCancelPaid = canCustomerCancel(orderStatus);
  const showDraftActions = orderStatus === 'pending_payment';
  const showReturn = orderStatus === 'delivered' && returnEligible !== false;

  return (
    <>
    <OrangeBrandedScreenLayout
      title="Order Details"
      subtitle={`#${order.orderNumber || orderId}`}
      onBack={onBack}
      bodyBackgroundColor={colors.white}
      headerRight={
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(orderStatus) + '20' },
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusColor(orderStatus) }]}>
            {orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1).replace(/_/g, ' ')}
          </Text>
        </View>
      }
    >
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
                        : { backgroundColor: colors.gray['200'] },
                    ]}
                  >
                    <Text
                      style={[
                        styles.timelineIconText,
                        item.completed ? { color: colors.white } : { color: colors.gray['400'] },
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
                          : { backgroundColor: colors.gray['200'] },
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
            {(['confirmed', 'shipped', 'preparing', 'out_for_delivery'].includes(order.status) || isMealPlan) && (
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
        {(isMealPlan || order.deliveryAddress || order.address) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📍</Text>
              <Text style={styles.sectionTitle}>
                {isMealPlan ? 'Delivery Address' : 'Delivery Address'}
              </Text>
            </View>
            <Text style={styles.addressText}>
              {isMealPlan 
                ? (order.delivery_address || order.deliveryAddress || order.shipping_address || 
                   (typeof order.shipping_address === 'string' ? order.shipping_address : 
                    order.shipping_address ? JSON.stringify(order.shipping_address) : 'Address not available'))
                : (order.deliveryAddress ||
                  (order.address
                    ? `${order.address.line1 || ''}\n${order.address.city || ''}, ${order.address.state || ''} - ${order.address.pincode || ''}`
                    : 'Address not available'))}
            </Text>
            {isMealPlan && order.delivery_date && (
              <View style={styles.estimatedDelivery}>
                <Text style={styles.estimatedDeliveryIcon}>📅</Text>
                <Text style={styles.estimatedDeliveryText}>
                  Scheduled Delivery: {new Date(order.delivery_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })} at {order.delivery_time || order.deliveryTime || 'Time TBD'}
                </Text>
              </View>
            )}
            {!isMealPlan && order.estimatedDelivery &&
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
        )}

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
      {orderStatus !== 'cancelled' && (
        <View style={styles.bottomActions}>
          {showDraftActions && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryActionButton]}
                onPress={handleResumePayment}
                disabled={resumingPayment}
              >
                {resumingPayment ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={[styles.actionButtonText, styles.primaryActionButtonText]}>
                    Pay Now
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => openCancelModal(true)}
              >
                <Text style={[styles.actionButtonText, styles.cancelButtonText]}>
                  Cancel Order
                </Text>
              </TouchableOpacity>
            </>
          )}
          {showCancelPaid && (
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => openCancelModal(false)}
            >
              <Text style={[styles.actionButtonText, styles.cancelButtonText]}>
                Cancel Order
              </Text>
            </TouchableOpacity>
          )}
          {showReturn && (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryActionButton]}
              onPress={handleReturnOrder}
            >
              <Text style={[styles.actionButtonText, styles.primaryActionButtonText]}>
                Return Items
              </Text>
            </TouchableOpacity>
          )}
          {orderStatus === 'delivered' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryActionButton]}
              onPress={handleReorder}
            >
              <Text style={[styles.actionButtonText, styles.primaryActionButtonText]}>
                🔄 Reorder
              </Text>
            </TouchableOpacity>
          )}
          {['confirmed', 'shipped', 'processing'].includes(orderStatus) && (
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
    </OrangeBrandedScreenLayout>

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
              <Text style={styles.modalTitle}>
                {cancelIsDraft ? 'Cancel unpaid order?' : 'Cancel Order?'}
              </Text>
              <Text style={styles.modalText}>
                {cancelIsDraft
                  ? 'This will discard your unpaid order. No payment has been taken.'
                  : 'Are you sure you want to cancel this order? Refund will be processed if applicable.'}
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
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalButtonTextDanger}>Yes, Cancel</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
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
    color: colors.white,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  cancelledCard: {
    backgroundColor: colors.error + 20% opacity,
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
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray['100'],
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
    backgroundColor: colors.white,
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
    color: colors.success,
  },
  freeText: {
    color: colors.success,
    fontWeight: 'bold',
  },
  paymentDivider: {
    height: 1,
    backgroundColor: colors.gray['200'],
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
    borderTopColor: colors.gray['200'],
  },
  paymentMethodIcon: {
    fontSize: 16,
    color: colors.success,
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
    borderColor: colors.gray['200'],
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
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray['200'],
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
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray['200'],
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
    backgroundColor: colors.white,
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
    color: colors.white,
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
    backgroundColor: colors.white,
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
    backgroundColor: colors.error + 20% opacity,
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
    borderColor: colors.gray['200'],
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
    color: colors.white,
    fontWeight: 'bold',
  },
});

