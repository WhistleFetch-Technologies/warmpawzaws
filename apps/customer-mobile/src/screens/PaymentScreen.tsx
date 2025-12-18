/**
 * Payment Screen - Customer Mobile App
 * Payment with Razorpay integration, wallet support, and coupons
 * Matches web app PaymentPage
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey, API_BASE_URL } from '../../config/api';
import RazorpayService from '../../services/RazorpayService';
import NotificationService from '../../services/NotificationService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface PaymentScreenProps {
  route?: {
    params?: {
      bookingData?: any;
    };
  };
  navigation?: any;
}

type PaymentMethod = 'upi' | 'card' | 'wallet' | 'netbanking';

export default function PaymentScreen({
  route,
  navigation,
}: PaymentScreenProps) {
  const { user } = useAuth();
  const bookingData = route?.params?.bookingData || {};

  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('upi');
  const [showCouponInput, setShowCouponInput] = useState(false);

  useEffect(() => {
    loadWalletBalance();
    calculatePricing();
  }, []);

  const loadWalletBalance = async () => {
    try {
      const phone = user?.phone?.replace(/[^0-9]/g, '') || '';
      if (!phone) return;

      const response = await fetch(
        `${API_BASE_URL}/customer/wallet/${phone}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setWalletBalance(data.balance || 0);
      }
    } catch (error) {
      console.error('Error loading wallet:', error);
    }
  };

  const calculatePricing = () => {
    // Calculate from booking data
    const services = bookingData.services || [];
    const servicesPrice = services.reduce((sum: number, service: any) => {
      return sum + (service.price || service.customPrice || 0);
    }, 0);
    
    const addOnsPrice = (bookingData.addOns || []).reduce((sum: number, addon: any) => {
      return sum + (addon.price || 0);
    }, 0);
    
    return {
      servicesPrice,
      addOnsPrice,
      subtotal: servicesPrice + addOnsPrice,
    };
  };

  const pricing = calculatePricing();
  const gst = pricing.subtotal * 0.18; // 18% GST
  const discount = appliedCoupon ? (pricing.subtotal * appliedCoupon.discount / 100) : 0;
  const walletDeduction = useWallet ? Math.min(walletBalance, pricing.subtotal - discount) : 0;
  const finalAmount = Math.max(0, pricing.subtotal + gst - discount - walletDeduction);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      Alert.alert('Error', 'Please enter a coupon code');
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/coupon/validate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: couponCode,
            amount: pricing.subtotal,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          setAppliedCoupon(data);
          Alert.alert('Success', 'Coupon applied successfully!');
        } else {
          Alert.alert('Error', data.error || 'Invalid coupon code');
        }
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Invalid coupon code');
      }
    } catch (error) {
      console.error('Coupon validation error:', error);
      Alert.alert('Error', 'Failed to validate coupon');
    }
  };

  const handlePayment = async () => {
    if (finalAmount <= 0 && !useWallet) {
      Alert.alert('Error', 'Invalid payment amount');
      return;
    }

    setLoading(true);

    try {
      const phone = user?.phone?.replace(/[^0-9]/g, '') || '';
      
      // 1. Create booking first
      const bookingPayload = {
        customerPhone: phone,
        petId: bookingData.petId,
        petName: bookingData.pet?.name || 'Pet',
        vendorId: bookingData.vendorId,
        vendorName: bookingData.vendorName,
        serviceId: bookingData.serviceId,
        serviceName: bookingData.services?.[0]?.name || 'Service',
        serviceType: bookingData.serviceType || 'center',
        serviceStyle: bookingData.serviceType === 'home' ? 'at_home' : 
                      bookingData.serviceType === 'tele' ? 'tele' : 'at_center',
        scheduledDate: bookingData.scheduledDate,
        scheduledTime: bookingData.scheduledTime,
        address: bookingData.address,
        services: bookingData.services,
        addOns: bookingData.addOns || [],
        amount: finalAmount,
        paymentMethod: selectedPaymentMethod,
        walletUsed: walletDeduction,
        couponApplied: appliedCoupon?.code || null,
      };

      console.log('📤 Creating booking:', bookingPayload);

      const bookingResponse = await fetch(
        `${API_BASE_URL}/customer/booking`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(bookingPayload),
        }
      );

      if (!bookingResponse.ok) {
        const errorData = await bookingResponse.json();
        throw new Error(errorData.error || 'Failed to create booking');
      }

      const bookingResult = await bookingResponse.json();
      const bookingId = bookingResult.bookingId || bookingResult.booking?.id;

      if (!bookingId) {
        throw new Error('Booking creation failed - no booking ID returned');
      }

      // 2. Initiate payment if amount > 0
      if (finalAmount > 0) {
        try {
          const initiateResponse = await fetch(
            `${API_BASE_URL}/payments/initiate`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${publicAnonKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                bookingId,
                customerId: user?.id || phone,
                vendorId: bookingData.vendorId,
                amount: finalAmount,
                paymentMethod: selectedPaymentMethod,
              }),
            }
          );

          if (!initiateResponse.ok) {
            const errorData = await initiateResponse.json();
            // Mark booking as payment_failed
            await fetch(
              `${API_BASE_URL}/bookings/${bookingId}/status`,
              {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${publicAnonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  status: 'cancelled',
                  paymentStatus: 'failed',
                  cancellationReason: 'Payment initiation failed',
                }),
              }
            );
            throw new Error(errorData.error || 'Failed to initiate payment');
          }

          const initiateData = await initiateResponse.json();

          // 3. Process payment with Razorpay (Marketplace Mode)
          const paymentResult = await RazorpayService.processPayment(
            finalAmount,
            {
              name: user?.name,
              email: user?.email,
              contact: phone,
            },
            bookingId,
            `Booking for ${bookingData.services?.[0]?.name || 'Service'}`,
            bookingData.vendorId // Pass vendorId for marketplace settlement
          );

          if (!paymentResult.success) {
            // Mark booking as payment_failed on payment failure
            await fetch(
              `${API_BASE_URL}/bookings/${bookingId}/status`,
              {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${publicAnonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  status: 'cancelled',
                  paymentStatus: 'failed',
                  cancellationReason: paymentResult.error || 'Payment processing failed',
                }),
              }
            );
            throw new Error(paymentResult.error || 'Payment failed');
          }

          // Payment successful - booking status will be updated by payment verification endpoint
          bookingResult.paymentId = paymentResult.paymentId;
        } catch (paymentError: any) {
          // Payment failed - booking is already marked as cancelled above
          console.error('Payment processing error:', paymentError);
          throw paymentError;
        }
      } else {
        // Free booking (wallet only or 0 amount) - confirm immediately
        bookingResult.paymentId = 'wallet_' + Date.now();
      }

      // Send payment confirmation notification
      NotificationService.showLocalNotification({
        type: 'payment',
        title: 'Payment Successful',
        message: `Payment of ₹${finalAmount.toFixed(2)} completed for your booking`,
        bookingId,
        action: 'view_booking',
        data: {
          amount: finalAmount,
          paymentId: bookingResult.paymentId,
        },
      });

      // Navigate to confirmation
      navigation?.navigate('BookingConfirmation', {
        bookingId,
        bookingData: {
          ...bookingResult.booking,
          ...bookingData,
        },
      });
    } catch (error: any) {
      console.error('Payment error:', error);
      Alert.alert('Payment Failed', error.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[Typography.h2, styles.headerTitle]}>Payment</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              Complete your booking
            </Text>
          </View>
        </View>

        {/* Booking Summary */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Booking Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={[Typography.bodySmall, styles.summaryLabel]}>Service</Text>
              <Text style={[Typography.bodySmall, styles.summaryValue]}>
                {bookingData.services?.[0]?.name || 'Service'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[Typography.bodySmall, styles.summaryLabel]}>Date & Time</Text>
              <Text style={[Typography.bodySmall, styles.summaryValue]}>
                {bookingData.scheduledDate} at {bookingData.scheduledTime}
              </Text>
            </View>
            {bookingData.address && (
              <View style={styles.summaryRow}>
                <Text style={[Typography.bodySmall, styles.summaryLabel]}>Address</Text>
                <Text style={[Typography.bodySmall, styles.summaryValue]} numberOfLines={2}>
                  {bookingData.address.addressLine1}, {bookingData.address.city}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Price Breakdown */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Price Breakdown</Text>
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={[Typography.body, styles.priceLabel]}>Subtotal</Text>
              <Text style={[Typography.body, styles.priceValue]}>₹{pricing.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={[Typography.body, styles.priceLabel]}>GST (18%)</Text>
              <Text style={[Typography.body, styles.priceValue]}>₹{gst.toFixed(2)}</Text>
            </View>
            {discount > 0 && (
              <View style={styles.priceRow}>
                <Text style={[Typography.body, styles.priceLabel, styles.discountText]}>
                  Discount ({appliedCoupon?.code})
                </Text>
                <Text style={[Typography.body, styles.priceValue, styles.discountText]}>
                  -₹{discount.toFixed(2)}
                </Text>
              </View>
            )}
            {walletDeduction > 0 && (
              <View style={styles.priceRow}>
                <Text style={[Typography.body, styles.priceLabel, styles.discountText]}>
                  Wallet Used
                </Text>
                <Text style={[Typography.body, styles.priceValue, styles.discountText]}>
                  -₹{walletDeduction.toFixed(2)}
                </Text>
              </View>
            )}
            <View style={[styles.priceRow, styles.totalRow]}>
              <Text style={[Typography.h3, styles.totalLabel]}>Total</Text>
              <Text style={[Typography.h3, styles.totalValue]}>₹{finalAmount.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Wallet */}
        {walletBalance > 0 && (
          <View style={styles.section}>
            <View style={styles.walletCard}>
              <View style={styles.walletHeader}>
                <Icon name="account-balance-wallet" size={24} color={BrandColors.primary.orange} />
                <View style={styles.walletInfo}>
                  <Text style={[Typography.body, styles.walletLabel]}>Wallet Balance</Text>
                  <Text style={[Typography.h4, styles.walletBalance]}>₹{walletBalance.toFixed(2)}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.toggle, useWallet && styles.toggleActive]}
                onPress={() => setUseWallet(!useWallet)}
              >
                <View style={[styles.toggleThumb, useWallet && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Coupon */}
        <View style={styles.section}>
          {!showCouponInput ? (
            <TouchableOpacity
              style={styles.couponButton}
              onPress={() => setShowCouponInput(true)}
            >
              <Icon name="local-offer" size={20} color={BrandColors.primary.orange} />
              <Text style={[Typography.body, styles.couponButtonText]}>
                {appliedCoupon ? `Applied: ${appliedCoupon.code}` : 'Apply Coupon'}
              </Text>
              <Icon name="chevron-right" size={24} color={BrandColors.neutral.gray400} />
            </TouchableOpacity>
          ) : (
            <View style={styles.couponInputContainer}>
              <TextInput
                style={styles.couponInput}
                placeholder="Enter coupon code"
                placeholderTextColor={BrandColors.neutral.gray400}
                value={couponCode}
                onChangeText={setCouponCode}
                autoCapitalize="characters"
              />
              <View style={styles.couponActions}>
                <TouchableOpacity
                  style={styles.couponCancelButton}
                  onPress={() => {
                    setShowCouponInput(false);
                    setCouponCode('');
                  }}
                >
                  <Text style={[Typography.bodySmall, { color: BrandColors.neutral.gray600 }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <BrandedButton
                  title="Apply"
                  onPress={handleApplyCoupon}
                  style={styles.couponApplyButton}
                />
              </View>
            </View>
          )}
        </View>

        {/* Payment Methods */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Payment Method</Text>
          <View style={styles.paymentMethods}>
            {(['upi', 'card', 'wallet', 'netbanking'] as PaymentMethod[]).map((method) => {
              const icons: Record<PaymentMethod, string> = {
                upi: 'account-balance-wallet',
                card: 'credit-card',
                wallet: 'account-balance',
                netbanking: 'account-balance',
              };
              const labels: Record<PaymentMethod, string> = {
                upi: 'UPI',
                card: 'Card',
                wallet: 'Wallet',
                netbanking: 'Net Banking',
              };
              const isSelected = selectedPaymentMethod === method;
              return (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.paymentMethodCard,
                    isSelected && styles.paymentMethodCardSelected,
                  ]}
                  onPress={() => setSelectedPaymentMethod(method)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={icons[method]}
                    size={24}
                    color={isSelected ? BrandColors.primary.orange : BrandColors.neutral.gray600}
                  />
                  <Text
                    style={[
                      Typography.body,
                      styles.paymentMethodLabel,
                      isSelected && styles.paymentMethodLabelSelected,
                    ]}
                  >
                    {labels[method]}
                  </Text>
                  <View
                    style={[
                      styles.radio,
                      isSelected && styles.radioSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Pay Button */}
      <View style={styles.footer}>
        <View style={styles.footerTotal}>
          <Text style={[Typography.bodySmall, styles.footerLabel]}>Total Amount</Text>
          <Text style={[Typography.h2, styles.footerAmount]}>₹{finalAmount.toFixed(2)}</Text>
        </View>
        <BrandedButton
          title={loading ? 'Processing...' : `Pay ₹${finalAmount.toFixed(2)}`}
          onPress={handlePayment}
          disabled={loading || finalAmount <= 0}
          loading={loading}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl + 120,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    color: BrandColors.neutral.gray600,
  },
  section: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  summaryCard: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryLabel: {
    color: BrandColors.neutral.gray600,
  },
  summaryValue: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  priceCard: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    color: BrandColors.neutral.gray700,
  },
  priceValue: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  discountText: {
    color: BrandColors.semantic.success,
  },
  totalRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
  totalLabel: {
    color: BrandColors.neutral.gray900,
  },
  totalValue: {
    color: BrandColors.primary.orange,
  },
  walletCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    flex: 1,
  },
  walletInfo: {
    flex: 1,
  },
  walletLabel: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.xs,
  },
  walletBalance: {
    color: BrandColors.primary.orange,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: BrandColors.neutral.gray300,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: BrandColors.primary.orange,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  couponButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  couponButtonText: {
    flex: 1,
    color: BrandColors.neutral.gray700,
  },
  couponInputContainer: {
    gap: Spacing.base,
  },
  couponInput: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
  },
  couponActions: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  couponCancelButton: {
    flex: 1,
    padding: Spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponApplyButton: {
    flex: 1,
  },
  paymentMethods: {
    gap: Spacing.sm,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
  },
  paymentMethodCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  paymentMethodLabel: {
    flex: 1,
    color: BrandColors.neutral.gray700,
  },
  paymentMethodLabelSelected: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: BrandColors.primary.orange,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BrandColors.primary.orange,
  },
  footer: {
    padding: Spacing.lg,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
    gap: Spacing.base,
  },
  footerTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: {
    color: BrandColors.neutral.gray600,
  },
  footerAmount: {
    color: BrandColors.primary.orange,
  },
});

