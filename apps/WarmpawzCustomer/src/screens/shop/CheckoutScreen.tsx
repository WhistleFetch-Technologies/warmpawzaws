/**
 * Checkout Screen - Mobile
 * Standalone checkout screen with payment integration
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
  TextInput,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'razorpay' | 'cod'>('razorpay');
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
        // Fallback to empty array if no customerId
        setAddresses([]);
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
      setAddresses([]);
    }
  };

  const getSubtotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotal = () => {
    return getSubtotal() - discount;
  };

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

    try {
      setLoading(true);

      const orderData = {
        phone,
        customerId,
        items: cart,
        address: selectedAddress,
        paymentMethod,
        couponCode: couponCode || undefined,
        discount,
        totalAmount: getTotal(),
      };

      // Call checkout API for e-commerce orders
      if (!customerId) {
        Alert.alert('Error', 'Customer ID required for checkout');
        return;
      }

      const response = await CustomerApi.checkout(
        customerId,
        paymentMethod,
        selectedAddress.id,
        couponCode || undefined
      );
      
      // Extract order ID from response
      const orderId = (response as any).orderId || (response as any).order?.id || (response as any).id;

      // Clear cart
      await AsyncStorage.removeItem('warmpawz_cart');

      if (onSuccess && orderId) {
        onSuccess(orderId);
      } else if (onNavigate && orderId) {
        onNavigate('OrderSuccess', { orderId });
      } else {
        Alert.alert('Success', 'Order placed successfully!');
      }
    } catch (error: any) {
      console.error('Error placing order:', error);
      Alert.alert('Error', error.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Delivery Address */}
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

        {/* Coupon Code */}
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

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === 'razorpay' && styles.paymentOptionSelected,
            ]}
            onPress={() => setPaymentMethod('razorpay')}
          >
            <Text style={styles.paymentIcon}>💳</Text>
            <Text style={styles.paymentText}>Razorpay</Text>
            {paymentMethod === 'razorpay' && (
              <View style={styles.selectedIndicator}>
                <Text style={styles.selectedCheck}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === 'wallet' && styles.paymentOptionSelected,
            ]}
            onPress={() => setPaymentMethod('wallet')}
          >
            <Text style={styles.paymentIcon}>💰</Text>
            <Text style={styles.paymentText}>Wallet</Text>
            {paymentMethod === 'wallet' && (
              <View style={styles.selectedIndicator}>
                <Text style={styles.selectedCheck}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === 'cod' && styles.paymentOptionSelected,
            ]}
            onPress={() => setPaymentMethod('cod')}
          >
            <Text style={styles.paymentIcon}>💵</Text>
            <Text style={styles.paymentText}>Cash on Delivery</Text>
            {paymentMethod === 'cod' && (
              <View style={styles.selectedIndicator}>
                <Text style={styles.selectedCheck}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Order Summary */}
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
              Place Order • ₹{getTotal().toLocaleString()}
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
    backgroundColor: colors.gray.100,
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
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  paymentOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  paymentIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  paymentText: {
    flex: 1,
    fontSize: 16,
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
    backgroundColor: colors.gray.400,
  },
  placeOrderButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

