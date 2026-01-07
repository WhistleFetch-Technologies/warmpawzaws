/**
 * Payment Methods Screen - Mobile
 * Manage payment methods
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
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface PaymentMethodsScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'upi' | 'wallet' | 'netbanking';
  last4?: string;
  cardType?: string;
  upiId?: string;
  bankName?: string;
  isDefault: boolean;
  expiryMonth?: number;
  expiryYear?: number;
}

export function PaymentMethodsScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
}: PaymentMethodsScreenProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getPaymentMethods(customerId || phone);
      const methods = Array.isArray(response) ? response : response.paymentMethods || [];
      setPaymentMethods(methods);
    } catch (error) {
      console.error('Error loading payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      if (customerId) {
        await CustomerApi.setDefaultPaymentMethod(customerId, methodId);
        setPaymentMethods(paymentMethods.map(method => ({
          ...method,
          isDefault: method.id === methodId,
        })));
        Alert.alert('Success', 'Default payment method updated');
      }
    } catch (error: any) {
      console.error('Error setting default payment method:', error);
      Alert.alert('Error', error.message || 'Failed to set default payment method');
    }
  };

  const handleDelete = (methodId: string) => {
    Alert.alert(
      'Delete Payment Method',
      'Are you sure you want to delete this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await CustomerApi.deletePaymentMethod(methodId);
              setPaymentMethods(paymentMethods.filter(m => m.id !== methodId));
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete payment method');
            }
          },
        },
      ]
    );
  };

  const getPaymentMethodIcon = (type: string) => {
    switch (type) {
      case 'card':
        return '💳';
      case 'upi':
        return '📱';
      case 'wallet':
        return '👛';
      case 'netbanking':
        return '🏦';
      default:
        return '💳';
    }
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch (method.type) {
      case 'card':
        return `**** **** **** ${method.last4}`;
      case 'upi':
        return method.upiId || 'UPI';
      case 'wallet':
        return 'Wallet';
      case 'netbanking':
        return method.bankName || 'Net Banking';
      default:
        return 'Payment Method';
    }
  };

  const renderPaymentMethod = ({ item }: { item: PaymentMethod }) => (
    <View style={styles.paymentMethodCard}>
      <View style={styles.paymentMethodHeader}>
        <View style={styles.paymentMethodInfo}>
          <Text style={styles.paymentMethodIcon}>{getPaymentMethodIcon(item.type)}</Text>
          <View style={styles.paymentMethodDetails}>
            <Text style={styles.paymentMethodLabel}>{getPaymentMethodLabel(item)}</Text>
            {item.cardType && (
              <Text style={styles.paymentMethodType}>{item.cardType}</Text>
            )}
            {item.expiryMonth && item.expiryYear && (
              <Text style={styles.paymentMethodExpiry}>
                Expires {item.expiryMonth}/{item.expiryYear}
              </Text>
            )}
          </View>
        </View>
        {item.isDefault && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>DEFAULT</Text>
          </View>
        )}
      </View>
      <View style={styles.paymentMethodActions}>
        {!item.isDefault && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSetDefault(item.id)}
          >
            <Text style={styles.actionButtonText}>Set as Default</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item.id)}
        >
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
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
        <Text style={styles.headerTitle}>Payment Methods</Text>
        <View style={styles.placeholder} />
      </View>

      {paymentMethods.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💳</Text>
          <Text style={styles.emptyTitle}>No Payment Methods</Text>
          <Text style={styles.emptySubtitle}>
            Add a payment method to get started
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onNavigate && onNavigate('AddPaymentMethod')}
          >
            <Text style={styles.addButtonText}>+ Add Payment Method</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={paymentMethods}
            renderItem={renderPaymentMethod}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
          />
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => onNavigate && onNavigate('AddPaymentMethod')}
            >
              <Text style={styles.addButtonText}>+ Add New Payment Method</Text>
            </TouchableOpacity>
          </View>
        </>
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
  paymentMethodCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentMethodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  paymentMethodInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  paymentMethodIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  paymentMethodDetails: {
    flex: 1,
  },
  paymentMethodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  paymentMethodType: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  paymentMethodExpiry: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  defaultBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  defaultBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  paymentMethodActions: {
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
  deleteButton: {
    backgroundColor: colors.error + 20% opacity,
  },
  deleteButtonText: {
    color: colors.error,
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
    marginBottom: spacing.lg,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
