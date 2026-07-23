/**
 * Order Return Screen - Mobile
 * Return request via POST /customer/orders/:id/return (return_requests table)
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
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi, OrderReturnApi, SHOP_RETURN_REASONS } from '../../services/api';

interface OrderReturnScreenProps {
  orderId: string;
  order?: any;
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: () => void;
}

type SelectedItem = { orderItemId: string; quantity: number };

export function OrderReturnScreen({
  orderId,
  order: initialOrder,
  phone,
  onBack,
  onNavigate,
  onSuccess,
}: OrderReturnScreenProps) {
  const [loading, setLoading] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(!initialOrder);
  const [order, setOrder] = useState<any>(initialOrder);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [selectedReasonId, setSelectedReasonId] = useState<string>('');
  const [otherReason, setOtherReason] = useState('');
  const [returnItems, setReturnItems] = useState<SelectedItem[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');

  useEffect(() => {
    loadOrderAndEligibility();
  }, [orderId]);

  const loadOrderAndEligibility = async () => {
    try {
      setLoadingOrder(true);
      let orderData = initialOrder;
      if (!orderData) {
        const response = await CustomerApi.getOrderDetails(orderId);
        orderData = response.order || response;
        setOrder(orderData);
      }

      try {
        const eligibility = await CustomerApi.getOrderReturnEligibility(orderId);
        const isEligible = (eligibility as { eligible?: boolean })?.eligible !== false;
        setEligible(isEligible);
        if (!isEligible) {
          Alert.alert(
            'Not eligible',
            (eligibility as { message?: string })?.message ||
              'This order is not eligible for return',
          );
        }
      } catch {
        setEligible(true);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load order');
    } finally {
      setLoadingOrder(false);
    }
  };

  const getOrderItemId = (item: Record<string, unknown>): string =>
    String(item.id || item.orderItemId || item.order_item_id || '');

  const toggleItem = (item: Record<string, unknown>) => {
    const orderItemId = getOrderItemId(item);
    if (!orderItemId) return;

    const qty = Math.max(1, parseInt(String(item.quantity ?? '1'), 10) || 1);
    const existing = returnItems.find((i) => i.orderItemId === orderItemId);
    if (existing) {
      setReturnItems(returnItems.filter((i) => i.orderItemId !== orderItemId));
    } else {
      setReturnItems([...returnItems, { orderItemId, quantity: qty }]);
    }
  };

  const isItemSelected = (item: Record<string, unknown>) =>
    returnItems.some((i) => i.orderItemId === getOrderItemId(item));

  const handleSubmitReturn = async () => {
    if (!selectedReasonId) {
      Alert.alert('Error', 'Please select a return reason');
      return;
    }

    if (selectedReasonId === 'other' && !otherReason.trim()) {
      Alert.alert('Error', 'Please provide a reason');
      return;
    }

    if (returnItems.length === 0) {
      Alert.alert('Error', 'Please select items to return');
      return;
    }

    const reasonLabel =
      SHOP_RETURN_REASONS.find((r) => r.id === selectedReasonId)?.label || selectedReasonId;
    const reason =
      selectedReasonId === 'other'
        ? otherReason.trim()
        : `${selectedReasonId}:${reasonLabel}${additionalNotes ? ` — ${additionalNotes}` : ''}`;

    try {
      setLoading(true);
      await OrderReturnApi.createReturn(orderId, {
        reason,
        items: returnItems,
      });

      Alert.alert(
        'Return Request Submitted',
        'Your return request has been submitted. The seller will review it shortly.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (onSuccess) {
                onSuccess();
              } else if (onNavigate) {
                onNavigate('OrderDetail', { orderId, order });
              }
            },
          },
        ],
      );
    } catch (error: any) {
      console.error('Error submitting return:', error);
      Alert.alert('Error', error.message || 'Failed to submit return request');
    } finally {
      setLoading(false);
    }
  };

  if (loadingOrder) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenShell>
    );
  }

  if (eligible === false) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Return Request</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.ineligibleBox}>
          <Text style={styles.ineligibleText}>This order is not eligible for return.</Text>
        </View>
      </ScreenShell>
    );
  }

  const orderItems = order?.items || [];

  return (
    <ScreenShell style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Return Request</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order #{order?.orderNumber || orderId}</Text>
          {order && (
            <View style={styles.orderInfo}>
              <Text style={styles.orderDate}>
                Ordered on{' '}
                {new Date(order.createdAt || order.created_at || Date.now()).toLocaleDateString()}
              </Text>
              <Text style={styles.orderTotal}>
                Total: ₹
                {(order.totalAmount || order.total_amount || 0).toLocaleString?.() ||
                  order.totalAmount ||
                  order.total_amount ||
                  '0'}
              </Text>
            </View>
          )}
        </View>

        {orderItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Items to Return</Text>
            {orderItems.map((item: Record<string, unknown>, index: number) => {
              const itemId = getOrderItemId(item) || `item-${index}`;
              return (
                <TouchableOpacity
                  key={itemId}
                  style={[styles.itemCard, isItemSelected(item) && styles.itemCardSelected]}
                  onPress={() => toggleItem(item)}
                >
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>
                      {String(item.productName || item.name || 'Item')}
                    </Text>
                    <Text style={styles.itemQuantity}>Qty: {String(item.quantity ?? 1)}</Text>
                  </View>
                  {isItemSelected(item) && (
                    <View style={styles.selectedIndicator}>
                      <Text style={styles.selectedCheck}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reason for Return</Text>
          {SHOP_RETURN_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.id}
              style={[
                styles.reasonCard,
                selectedReasonId === reason.id && styles.reasonCardSelected,
              ]}
              onPress={() => setSelectedReasonId(reason.id)}
            >
              <Text style={styles.reasonText}>{reason.label}</Text>
              {selectedReasonId === reason.id && (
                <View style={styles.selectedIndicator}>
                  <Text style={styles.selectedCheck}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {selectedReasonId === 'other' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Please specify</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter reason..."
              value={otherReason}
              onChangeText={setOtherReason}
              multiline
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Any additional information..."
            value={additionalNotes}
            onChangeText={setAdditionalNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmitReturn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Submit Return Request</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ineligibleBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  ineligibleText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
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
  content: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  orderInfo: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  itemCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  itemQuantity: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheck: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  reasonCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  textInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray['400'],
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
