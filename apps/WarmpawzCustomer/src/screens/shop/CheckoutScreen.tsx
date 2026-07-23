/**
 * Checkout Screen - Mobile
 * Shop checkout: POST /ecommerce/orders + Razorpay ecommerce_order + verify
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
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildMobileEcommerceOrderPayload,
  generateIdempotencyKey,
} from '../../utils/ecommerce/build-ecommerce-order-payload';
import { extractEcommerceOrderIdFromResponse } from '../../utils/ecommerce/ecommerce-razorpay-payload';
import { resumeShopOrderPayment } from '../../utils/ecommerce/resume-shop-order-payment';

interface CheckoutScreenProps {
  phone: string;
  customerId?: string;
  cart?: any[];
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (orderId: string) => void;
}

interface Address {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export function CheckoutScreen({
  phone,
  customerId,
  cart = [],
  onBack,
  onNavigate,
  onSuccess,
}: CheckoutScreenProps) {
  const [loading, setLoading] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      if (customerId) {
        const response = await CustomerApi.getAddresses(customerId);
        const addressesData = Array.isArray(response) ? response : (response as any).addresses || [];
        const formattedAddresses: Address[] = addressesData.map((addr: any) => ({
          id: addr.id,
          name: addr.label || addr.name || 'Address',
          phone: addr.phone || phone,
          address: addr.addressLine1 || addr.address || '',
          city: addr.city || '',
          state: addr.state || '',
          pincode: addr.pincode || '',
          isDefault: addr.isDefault || false,
        }));
        setAddresses(formattedAddresses);
        setSelectedAddress(formattedAddresses.find(a => a.isDefault) || formattedAddresses[0] || null);
      } else {
        setAddresses([]);
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
      setAddresses([]);
    }
  };

  const getSubtotal = () => cart.reduce((total, item) => total + item.price * item.quantity, 0);

  const getTotal = () => getSubtotal() - discount;

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      Alert.alert('Error', 'Please enter a coupon code');
      return;
    }

    if (!customerId) {
      Alert.alert('Error', 'Customer ID required');
      return;
    }

    try {
      setApplyingCoupon(true);
      const subtotal = getSubtotal();
      const response = await CustomerApi.validateCoupon(couponCode.toUpperCase(), subtotal, customerId);

      if ((response as any).valid) {
        setDiscount((response as any).discountAmount || 0);
        Alert.alert('Success', `Coupon applied! You saved ₹${(response as any).discountAmount || 0}`);
      } else {
        Alert.alert('Error', (response as any).error || 'Invalid coupon code');
        setCouponCode('');
      }
    } catch (error: any) {
      console.error('Error validating coupon:', error);
      Alert.alert('Error', error.message || 'Invalid coupon code');
      setCouponCode('');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      Alert.alert('Error', 'Please select a delivery address');
      return;
    }

    if (cart.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return;
    }

    if (!customerId) {
      Alert.alert('Error', 'Customer ID required for checkout');
      return;
    }

    try {
      setLoading(true);

      const orderPayload = buildMobileEcommerceOrderPayload({
        phone,
        customerId,
        cart,
        shippingAddress: selectedAddress,
        discount,
        idempotencyKey: generateIdempotencyKey(),
        couponCode: couponCode || undefined,
      });

      const result = await CustomerApi.createEcommerceOrder(orderPayload);
      const shopOrderId = extractEcommerceOrderIdFromResponse(result);
      if (!shopOrderId) {
        throw new Error('Order was not created');
      }

      let profile: unknown = null;
      try {
        profile = await CustomerApi.getCustomerByPhone(phone);
      } catch {
        /* non-fatal */
      }

      await resumeShopOrderPayment({
        orderId: shopOrderId,
        payableAmount: getTotal(),
        customerId,
        phone,
        prefillName: selectedAddress.name,
        profile,
        onSuccess: async (paidOrderId) => {
          await AsyncStorage.removeItem('warmpawz_cart');
          if (onSuccess) {
            onSuccess(paidOrderId);
          } else if (onNavigate) {
            onNavigate('OrderSuccess', { orderId: paidOrderId });
          } else {
            Alert.alert('Success', 'Order placed successfully!');
          }
        },
        onDismiss: () => {
          Alert.alert(
            'Payment pending',
            'Your order was created. You can complete payment from order details.',
            [
              {
                text: 'View order',
                onPress: () => onNavigate?.('OrderDetail', { orderId: shopOrderId }),
              },
              { text: 'OK' },
            ],
          );
        },
      });
    } catch (error: any) {
      console.error('Error placing order:', error);
      const message = error?.message || 'Failed to place order. Please try again.';
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('Error', message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          {addresses.map((address) => (
            <TouchableOpacity
              key={address.id}
              style={[
                styles.addressCard,
                selectedAddress?.id === address.id && styles.addressCardSelected,
              ]}
              onPress={() => setSelectedAddress(address)}
            >
              <View style={styles.addressInfo}>
                <Text style={styles.addressName}>{address.name}</Text>
                <Text style={styles.addressText}>{address.address}</Text>
                <Text style={styles.addressText}>
                  {address.city}, {address.state} - {address.pincode}
                </Text>
                <Text style={styles.addressPhone}>{address.phone}</Text>
              </View>
              {selectedAddress?.id === address.id && (
                <View style={styles.selectedIndicator}>
                  <Text style={styles.selectedCheck}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.addAddressButton}
            onPress={() => onNavigate && onNavigate('Addresses')}
          >
            <Text style={styles.addAddressButtonText}>+ Add New Address</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coupon Code</Text>
          <View style={styles.couponContainer}>
            <TextInput
              style={styles.couponInput}
              placeholder="Enter coupon code"
              value={couponCode}
              onChangeText={setCouponCode}
            />
            <TouchableOpacity
              style={styles.applyButton}
              onPress={applyCoupon}
              disabled={applyingCoupon}
            >
              {applyingCoupon ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.applyButtonText}>Apply</Text>
              )}
            </TouchableOpacity>
          </View>
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>₹{discount} discount applied</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.paymentInfoCard}>
            <Text style={styles.paymentIcon}>💳</Text>
            <Text style={styles.paymentInfoText}>Pay securely with Razorpay (UPI, cards, wallets)</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₹{getSubtotal().toLocaleString()}</Text>
            </View>
            {discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount</Text>
                <Text style={[styles.summaryValue, styles.discountValue]}>
                  -₹{discount.toLocaleString()}
                </Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery</Text>
              <Text style={styles.summaryValue}>Free</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₹{getTotal().toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.placeOrderButton, loading && styles.placeOrderButtonDisabled]}
          onPress={handlePlaceOrder}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.placeOrderButtonText}>
              Pay & Place Order • ₹{getTotal().toLocaleString()}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenShell>
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
  addressCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  addressCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  addressInfo: {
    flex: 1,
  },
  addressName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  addressText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  addressPhone: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
  addAddressButton: {
    backgroundColor: colors.gray['100'],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addAddressButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  couponContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  couponInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
  },
  applyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
  },
  applyButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  discountBadge: {
    backgroundColor: '#dcfce7',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  discountText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '600',
  },
  paymentInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  paymentIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  paymentInfoText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  discountValue: {
    color: '#16a34a',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  footer: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
  },
  placeOrderButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  placeOrderButtonDisabled: {
    backgroundColor: colors.gray['400'],
  },
  placeOrderButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
