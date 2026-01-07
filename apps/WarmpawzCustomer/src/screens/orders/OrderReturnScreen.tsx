/**
 * Order Return Screen - Mobile
 * Return request for orders
 * Identical functionality to web app
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi, OrderReturnApi } from '../../services/api';

interface OrderReturnScreenProps {
  orderId: string;
  order?: any;
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: () => void;
}

const RETURN_REASONS = [
  'Defective/Damaged Product',
  'Wrong Item Received',
  'Not as Described',
  'Size/Color Mismatch',
  'Changed My Mind',
  'Other',
];

export function OrderReturnScreen({
  orderId,
  order,
  phone,
  onBack,
  onNavigate,
  onSuccess,
}: OrderReturnScreenProps) {
  const [loading, setLoading] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [otherReason, setOtherReason] = useState('');
  const [returnItems, setReturnItems] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');

  const handleSubmitReturn = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a return reason');
      return;
    }

    if (selectedReason === 'Other' && !otherReason.trim()) {
      Alert.alert('Error', 'Please provide a reason');
      return;
    }

    if (returnItems.length === 0) {
      Alert.alert('Error', 'Please select items to return');
      return;
    }

    try {
      setLoading(true);

      const returnData = {
        orderId,
        phone,
        reason: selectedReason === 'Other' ? otherReason : selectedReason,
        items: returnItems,
        notes: additionalNotes,
      };

      // ✅ API Integration: Use OrderReturnApi
      const customerId = await CustomerApi.getCustomerByPhone(phone).then(c => c.id || c.customerId).catch(() => null);
      const returnResponse = await OrderReturnApi.createReturn({
        orderId,
        items: returnItems.map(itemId => ({ itemId, quantity: 1 })),
        reason: returnData.reason,
        customerId: customerId || phone,
      });

      Alert.alert(
        'Return Request Submitted',
        'Your return request has been submitted. We will process it shortly.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (onSuccess) {
                onSuccess();
              } else if (onNavigate) {
                onNavigate('OrderDetail', { orderId });
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error submitting return:', error);
      Alert.alert('Error', error.message || 'Failed to submit return request');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (itemId: string) => {
    if (returnItems.includes(itemId)) {
      setReturnItems(returnItems.filter(id => id !== itemId));
    } else {
      setReturnItems([...returnItems, itemId]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Return Request</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order #{orderId}</Text>
          {order && (
            <View style={styles.orderInfo}>
              <Text style={styles.orderDate}>
                Ordered on {new Date(order.createdAt || Date.now()).toLocaleDateString()}
              </Text>
              <Text style={styles.orderTotal}>
                Total: ₹{order.totalAmount?.toLocaleString() || '0'}
              </Text>
            </View>
          )}
        </View>

        {/* Select Items */}
        {order?.items && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Items to Return</Text>
            {order.items.map((item: any) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.itemCard,
                  returnItems.includes(item.id) && styles.itemCardSelected,
                ]}
                onPress={() => toggleItem(item.id)}
              >
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                </View>
                {returnItems.includes(item.id) && (
                  <View style={styles.selectedIndicator}>
                    <Text style={styles.selectedCheck}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Return Reason */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reason for Return</Text>
          {RETURN_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={[
                styles.reasonCard,
                selectedReason === reason && styles.reasonCardSelected,
              ]}
              onPress={() => setSelectedReason(reason)}
            >
              <Text style={styles.reasonText}>{reason}</Text>
              {selectedReason === reason && (
                <View style={styles.selectedIndicator}>
                  <Text style={styles.selectedCheck}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Other Reason Input */}
        {selectedReason === 'Other' && (
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

        {/* Additional Notes */}
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

        {/* Submit Button */}
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
    backgroundColor: colors.gray.400,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

