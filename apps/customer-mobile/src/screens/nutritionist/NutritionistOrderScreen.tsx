/**
 * Nutritionist Order Screen - Customer Mobile App
 * Place meal order with delivery address and subscription options
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import NutritionistService from '../../services/NutritionistService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface NutritionistOrderScreenProps {
  route?: {
    params?: {
      nutritionistId: string;
      items: Array<{ item: any; quantity: number }>;
    };
  };
  navigation?: any;
}

export default function NutritionistOrderScreen({
  route,
  navigation,
}: NutritionistOrderScreenProps) {
  const { user } = useAuth();
  const nutritionistId = route?.params?.nutritionistId || '';
  const cartItems = route?.params?.items || [];

  const [ordering, setOrdering] = useState(false);
  const [orderType, setOrderType] = useState<'one-time' | 'subscription'>('one-time');
  const [deliveryAddress, setDeliveryAddress] = useState({
    street: '',
    city: '',
    zip: '',
    location: { lat: 0, lng: 0 },
  });
  const [subscriptionDetails, setSubscriptionDetails] = useState({
    frequency: 'weekly' as 'daily' | 'weekly',
    startDate: '',
    endDate: '',
    deliverySlot: 'morning' as 'morning' | 'afternoon' | 'evening',
  });

  const totalAmount = cartItems.reduce(
    (sum, cartItem) => sum + cartItem.item.price * cartItem.quantity,
    0
  );

  const handlePlaceOrder = async () => {
    if (!deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.zip) {
      Alert.alert('Required', 'Please enter delivery address');
      return;
    }

    if (orderType === 'subscription') {
      if (!subscriptionDetails.startDate || !subscriptionDetails.endDate) {
        Alert.alert('Required', 'Please select subscription dates');
        return;
      }
    }

    try {
      setOrdering(true);
      const items = cartItems.map((cartItem) => ({
        itemId: cartItem.item.itemId,
        quantity: cartItem.quantity,
      }));

      const order = await NutritionistService.placeOrder(
        nutritionistId,
        items,
        orderType,
        deliveryAddress,
        orderType === 'subscription' ? subscriptionDetails : undefined,
        totalAmount
      );

      if (order) {
        Alert.alert(
          'Order Placed',
          `Your ${orderType === 'subscription' ? 'subscription' : 'order'} has been placed successfully!`,
          [
            {
              text: 'OK',
              onPress: () =>
                navigation?.navigate('BookingConfirmation', { bookingId: order.orderId }),
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to place order');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Error', 'Failed to place order');
    } finally {
      setOrdering(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[Typography.h2, styles.headerTitle]}>Place Order</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              {cartItems.length} items
            </Text>
          </View>
        </View>

        {/* Order Type */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Order Type</Text>
          <View style={styles.orderTypeButtons}>
            <TouchableOpacity
              style={[
                styles.orderTypeButton,
                orderType === 'one-time' && styles.orderTypeButtonActive,
              ]}
              onPress={() => setOrderType('one-time')}
            >
              <Icon
                name={orderType === 'one-time' ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={24}
                color={
                  orderType === 'one-time' ? BrandColors.primary.orange : BrandColors.neutral.gray400
                }
              />
              <View style={styles.orderTypeInfo}>
                <Text
                  style={[
                    Typography.body,
                    orderType === 'one-time' && styles.orderTypeTextActive,
                  ]}
                >
                  One-time Order
                </Text>
                <Text style={[Typography.bodyTiny, styles.orderTypeSubtext]}>
                  Single delivery
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.orderTypeButton,
                orderType === 'subscription' && styles.orderTypeButtonActive,
              ]}
              onPress={() => setOrderType('subscription')}
            >
              <Icon
                name={
                  orderType === 'subscription' ? 'radio-button-checked' : 'radio-button-unchecked'
                }
                size={24}
                color={
                  orderType === 'subscription'
                    ? BrandColors.primary.orange
                    : BrandColors.neutral.gray400
                }
              />
              <View style={styles.orderTypeInfo}>
                <Text
                  style={[
                    Typography.body,
                    orderType === 'subscription' && styles.orderTypeTextActive,
                  ]}
                >
                  Subscription
                </Text>
                <Text style={[Typography.bodyTiny, styles.orderTypeSubtext]}>
                  Recurring deliveries
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Subscription Details */}
        {orderType === 'subscription' && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Subscription Details</Text>
            <View style={styles.subscriptionRow}>
              <Text style={[Typography.bodySmall, styles.subscriptionLabel]}>Frequency</Text>
              <View style={styles.frequencyButtons}>
                {(['daily', 'weekly'] as const).map((freq) => (
                  <TouchableOpacity
                    key={freq}
                    style={[
                      styles.frequencyButton,
                      subscriptionDetails.frequency === freq && styles.frequencyButtonActive,
                    ]}
                    onPress={() =>
                      setSubscriptionDetails({ ...subscriptionDetails, frequency: freq })
                    }
                  >
                    <Text
                      style={[
                        Typography.bodyTiny,
                        subscriptionDetails.frequency === freq && styles.frequencyButtonTextActive,
                      ]}
                    >
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.subscriptionRow}>
              <Text style={[Typography.bodySmall, styles.subscriptionLabel]}>Start Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={BrandColors.neutral.gray400}
                value={subscriptionDetails.startDate}
                onChangeText={(text) =>
                  setSubscriptionDetails({ ...subscriptionDetails, startDate: text })
                }
              />
            </View>
            <View style={styles.subscriptionRow}>
              <Text style={[Typography.bodySmall, styles.subscriptionLabel]}>End Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={BrandColors.neutral.gray400}
                value={subscriptionDetails.endDate}
                onChangeText={(text) =>
                  setSubscriptionDetails({ ...subscriptionDetails, endDate: text })
                }
              />
            </View>
            <View style={styles.subscriptionRow}>
              <Text style={[Typography.bodySmall, styles.subscriptionLabel]}>Delivery Slot</Text>
              <View style={styles.slotButtons}>
                {(['morning', 'afternoon', 'evening'] as const).map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    style={[
                      styles.slotButton,
                      subscriptionDetails.deliverySlot === slot && styles.slotButtonActive,
                    ]}
                    onPress={() =>
                      setSubscriptionDetails({ ...subscriptionDetails, deliverySlot: slot })
                    }
                  >
                    <Text
                      style={[
                        Typography.bodyTiny,
                        subscriptionDetails.deliverySlot === slot && styles.slotButtonTextActive,
                      ]}
                    >
                      {slot.charAt(0).toUpperCase() + slot.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Delivery Address */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Delivery Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Street address"
            placeholderTextColor={BrandColors.neutral.gray400}
            value={deliveryAddress.street}
            onChangeText={(text) =>
              setDeliveryAddress({ ...deliveryAddress, street: text })
            }
          />
          <View style={styles.addressRow}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder="City"
              placeholderTextColor={BrandColors.neutral.gray400}
              value={deliveryAddress.city}
              onChangeText={(text) => setDeliveryAddress({ ...deliveryAddress, city: text })}
            />
            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder="ZIP Code"
              placeholderTextColor={BrandColors.neutral.gray400}
              value={deliveryAddress.zip}
              onChangeText={(text) => setDeliveryAddress({ ...deliveryAddress, zip: text })}
            />
          </View>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={() => {
              // TODO: Get current location
              Alert.alert('Location', 'Get current location');
            }}
          >
            <Icon name="my-location" size={20} color={BrandColors.primary.orange} />
            <Text style={[Typography.bodySmall, styles.locationButtonText]}>
              Use Current Location
            </Text>
          </TouchableOpacity>
        </View>

        {/* Order Summary */}
        <View style={styles.summaryCard}>
          <Text style={[Typography.h3, styles.summaryTitle]}>Order Summary</Text>
          {cartItems.map((cartItem, index) => (
            <View key={index} style={styles.summaryRow}>
              <Text style={[Typography.bodySmall, styles.summaryItem]}>
                {cartItem.item.name} × {cartItem.quantity}
              </Text>
              <Text style={[Typography.bodySmall, styles.summaryPrice]}>
                ₹{(cartItem.item.price * cartItem.quantity).toLocaleString()}
              </Text>
            </View>
          ))}
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={[Typography.h4, styles.summaryTotalLabel]}>Total</Text>
            <Text style={[Typography.h4, styles.summaryTotalValue]}>
              ₹{totalAmount.toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Place Order Button */}
      <View style={styles.footer}>
        <BrandedButton
          title={ordering ? 'Placing Order...' : `Place Order - ₹${totalAmount.toLocaleString()}`}
          onPress={handlePlaceOrder}
          disabled={ordering}
          variant="primary"
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
    paddingBottom: Spacing.xl + 100,
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
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  orderTypeButtons: {
    gap: Spacing.base,
  },
  orderTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
  },
  orderTypeButtonActive: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  orderTypeInfo: {
    flex: 1,
  },
  orderTypeTextActive: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  orderTypeSubtext: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.xs,
  },
  subscriptionRow: {
    marginBottom: Spacing.base,
  },
  subscriptionLabel: {
    color: BrandColors.neutral.gray700,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  frequencyButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  frequencyButton: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.neutral.gray100,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  frequencyButtonActive: {
    backgroundColor: BrandColors.primary.orange,
    borderColor: BrandColors.primary.orange,
  },
  frequencyButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  input: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  inputHalf: {
    flex: 1,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.base,
    backgroundColor: BrandColors.primary.orange + '10',
    borderRadius: BorderRadius.md,
  },
  locationButtonText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  summaryCard: {
    margin: Spacing.lg,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  summaryTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  summaryTotal: {
    marginTop: Spacing.base,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
  summaryItem: {
    color: BrandColors.neutral.gray700,
  },
  summaryPrice: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  summaryTotalLabel: {
    color: BrandColors.neutral.gray900,
  },
  summaryTotalValue: {
    color: BrandColors.primary.orange,
    fontWeight: '700',
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
    backgroundColor: '#FFFFFF',
  },
});

