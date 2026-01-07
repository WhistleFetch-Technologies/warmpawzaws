/**
 * Coupon Apply Screen - Mobile
 * Apply coupons to bookings/orders
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
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface CouponApplyScreenProps {
  bookingId?: string;
  orderId?: string;
  totalAmount: number;
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onApply?: (coupon: any, discount: number) => void;
}

interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minAmount?: number;
  maxDiscount?: number;
  validUntil?: string;
}

export function CouponApplyScreen({
  bookingId,
  orderId,
  totalAmount,
  phone,
  customerId,
  onBack,
  onNavigate,
  onApply,
}: CouponApplyScreenProps) {
  const [couponCode, setCouponCode] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    loadAvailableCoupons();
  }, []);

  const loadAvailableCoupons = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getAvailableCoupons(customerId || phone);
      const coupons = Array.isArray(response) ? response : response.coupons || [];
      setAvailableCoupons(coupons);
    } catch (error) {
      console.error('Error loading coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateCoupon = async (code: string) => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter a coupon code');
      return;
    }

    try {
      setValidating(true);
      const response = await CustomerApi.validateCoupon(code, totalAmount, bookingId || orderId);
      
      if (response.valid) {
        setSelectedCoupon(response.coupon);
        Alert.alert('Valid Coupon', `Coupon "${code}" is valid!`);
      } else {
        Alert.alert('Invalid Coupon', response.message || 'This coupon is not valid');
        setSelectedCoupon(null);
      }
    } catch (error: any) {
      console.error('Error validating coupon:', error);
      Alert.alert('Error', error.message || 'Failed to validate coupon');
      setSelectedCoupon(null);
    } finally {
      setValidating(false);
    }
  };

  const handleApplyCoupon = () => {
    if (!selectedCoupon) {
      Alert.alert('Error', 'Please select a valid coupon');
      return;
    }

    const discount = calculateDiscount(selectedCoupon, totalAmount);
    
    if (onApply) {
      onApply(selectedCoupon, discount);
    } else {
      Alert.alert(
        'Coupon Applied',
        `You saved ₹${discount}!`,
        [
          {
            text: 'OK',
            onPress: () => onBack(),
          },
        ]
      );
    }
  };

  const calculateDiscount = (coupon: Coupon, amount: number): number => {
    if (coupon.discountType === 'percentage') {
      const discount = (amount * coupon.discountValue) / 100;
      return coupon.maxDiscount ? Math.min(discount, coupon.maxDiscount) : discount;
    } else {
      return coupon.discountValue;
    }
  };

  const isCouponEligible = (coupon: Coupon): boolean => {
    if (coupon.minAmount && totalAmount < coupon.minAmount) {
      return false;
    }
    if (coupon.validUntil) {
      const validUntil = new Date(coupon.validUntil);
      if (validUntil < new Date()) {
        return false;
      }
    }
    return true;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Apply Coupon</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Total Amount */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Total Amount</Text>
          <Text style={styles.amountValue}>₹{totalAmount.toLocaleString()}</Text>
        </View>

        {/* Coupon Code Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enter Coupon Code</Text>
          <View style={styles.couponInputContainer}>
            <TextInput
              style={styles.couponInput}
              value={couponCode}
              onChangeText={setCouponCode}
              placeholder="Enter coupon code"
              autoCapitalize="characters"
              maxLength={20}
            />
            <TouchableOpacity
              style={[styles.validateButton, (!couponCode || validating) && styles.validateButtonDisabled]}
              onPress={() => handleValidateCoupon(couponCode)}
              disabled={!couponCode || validating}
            >
              {validating ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.validateButtonText}>Validate</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Selected Coupon */}
        {selectedCoupon && (
          <View style={styles.selectedCouponCard}>
            <View style={styles.selectedCouponHeader}>
              <View style={styles.selectedCouponInfo}>
                <Text style={styles.selectedCouponCode}>{selectedCoupon.code}</Text>
                <Text style={styles.selectedCouponTitle}>{selectedCoupon.title}</Text>
                <Text style={styles.selectedCouponDescription}>{selectedCoupon.description}</Text>
              </View>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setSelectedCoupon(null)}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.discountPreview}>
              <Text style={styles.discountLabel}>You Save:</Text>
              <Text style={styles.discountAmount}>
                ₹{calculateDiscount(selectedCoupon, totalAmount).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {/* Available Coupons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Coupons</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : availableCoupons.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No coupons available</Text>
            </View>
          ) : (
            availableCoupons.map((coupon) => {
              const eligible = isCouponEligible(coupon);
              return (
                <TouchableOpacity
                  key={coupon.id}
                  style={[
                    styles.couponCard,
                    !eligible && styles.couponCardDisabled,
                    selectedCoupon?.id === coupon.id && styles.couponCardSelected,
                  ]}
                  onPress={() => {
                    if (eligible) {
                      setSelectedCoupon(coupon);
                      setCouponCode(coupon.code);
                    }
                  }}
                  disabled={!eligible}
                >
                  <View style={styles.couponHeader}>
                    <View style={styles.couponInfo}>
                      <Text style={styles.couponCode}>{coupon.code}</Text>
                      <Text style={styles.couponTitle}>{coupon.title}</Text>
                    </View>
                    <View style={styles.couponDiscount}>
                      <Text style={styles.couponDiscountText}>
                        {coupon.discountType === 'percentage'
                          ? `${coupon.discountValue}%`
                          : `₹${coupon.discountValue}`}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.couponDescription}>{coupon.description}</Text>
                  {coupon.minAmount && (
                    <Text style={styles.couponMinAmount}>
                      Min. purchase: ₹{coupon.minAmount}
                    </Text>
                  )}
                  {!eligible && (
                    <Text style={styles.couponNotEligible}>
                      Not eligible for this order
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Apply Button */}
        {selectedCoupon && (
          <TouchableOpacity
            style={styles.applyButton}
            onPress={handleApplyCoupon}
          >
            <Text style={styles.applyButtonText}>
              Apply Coupon & Save ₹{calculateDiscount(selectedCoupon, totalAmount).toLocaleString()}
            </Text>
          </TouchableOpacity>
        )}
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
  amountCard: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  amountLabel: {
    fontSize: 14,
    color: colors.white,
    opacity: 0.9,
    marginBottom: spacing.xs,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.white,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  couponInputContainer: {
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
    fontSize: 16,
    color: colors.text,
  },
  validateButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
  },
  validateButtonDisabled: {
    backgroundColor: colors.gray.400,
  },
  validateButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  selectedCouponCard: {
    backgroundColor: '#dcfce7',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.success,
  },
  selectedCouponHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  selectedCouponInfo: {
    flex: 1,
  },
  selectedCouponCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  selectedCouponTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  selectedCouponDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  discountPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  discountLabel: {
    fontSize: 14,
    color: colors.text,
  },
  discountAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.success,
  },
  loadingContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  couponCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  couponCardDisabled: {
    opacity: 0.5,
  },
  couponCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.gradientOrange50,
  },
  couponHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  couponInfo: {
    flex: 1,
  },
  couponCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  couponTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  couponDiscount: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  couponDiscountText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  couponDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  couponMinAmount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  couponNotEligible: {
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.xs,
  },
  applyButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  applyButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

