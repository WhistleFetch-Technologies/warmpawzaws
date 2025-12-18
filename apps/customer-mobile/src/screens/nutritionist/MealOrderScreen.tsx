/**
 * Meal Order Screen - Customer Mobile App
 * Order selected meals from meal plan
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { API_BASE_URL, getPublicAnonKey } from '../../config/api';
import ErrorHandler from '../../utils/errorHandler';

interface MealItem {
  id: string;
  name: string;
  description: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  price: number;
  quantity?: number;
}

interface Address {
  id: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  lat?: number;
  lng?: number;
}

export default function MealOrderScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { nutritionistId, items } = route.params as {
    nutritionistId: string;
    items: MealItem[];
  };

  const [mealItems, setMealItems] = useState<MealItem[]>(items);
  const [loading, setLoading] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('online');

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      if (user?.id) {
        const response = await fetch(`${API_BASE_URL}/customer/${user.id}`, {
          headers: {
            Authorization: `Bearer ${getPublicAnonKey()}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.customer?.addresses) {
            setAddresses(data.customer.addresses);
            if (data.customer.addresses.length > 0) {
              setSelectedAddress(data.customer.addresses[0]);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
    }
  };

  const updateQuantity = (mealId: string, delta: number) => {
    setMealItems((prev) =>
      prev.map((item) =>
        item.id === mealId
          ? { ...item, quantity: Math.max(1, (item.quantity || 1) + delta) }
          : item
      )
    );
  };

  const calculateTotal = () => {
    return mealItems.reduce((total, item) => {
      return total + item.price * (item.quantity || 1);
    }, 0);
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      Alert.alert('Address Required', 'Please select a delivery address');
      return;
    }

    try {
      setOrdering(true);

      const orderData = {
        mealPlanId: null, // Individual meal order
        nutritionistId,
        customerId: user?.id,
        customerPhone: user?.phone,
        items: mealItems.map((item) => ({
          mealId: item.id,
          quantity: item.quantity || 1,
          price: item.price,
        })),
        deliveryAddress: {
          address: selectedAddress.address,
          city: selectedAddress.city,
          state: selectedAddress.state,
          pincode: selectedAddress.pincode,
          lat: selectedAddress.lat,
          lng: selectedAddress.lng,
        },
        paymentMethod,
        totalAmount: calculateTotal(),
      };

      const response = await fetch(`${API_BASE_URL}/nutritionist/meal-plan/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
        body: JSON.stringify(orderData),
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert('Order Placed', 'Your meal order has been placed successfully!', [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('Bookings' as never);
            },
          },
        ]);
      } else {
        const error = await response.json();
        ErrorHandler.showError(error);
      }
    } catch (error) {
      ErrorHandler.showError(error);
    } finally {
      setOrdering(false);
    }
  };

  const total = calculateTotal();

  return (
    <ScrollView style={styles.container}>
      {/* Order Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Items</Text>
        {mealItems.map((item) => (
          <View key={item.id} style={styles.orderItem}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemType}>{item.mealType.toUpperCase()}</Text>
            </View>
            <Text style={styles.itemDescription} numberOfLines={2}>
              {item.description}
            </Text>
            <View style={styles.itemFooter}>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(item.id, -1)}
                  disabled={(item.quantity || 1) === 1}
                >
                  <Icon name="remove" size={20} color={BrandColors.primary.orange} />
                </TouchableOpacity>
                <Text style={styles.quantityValue}>{item.quantity || 1}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(item.id, 1)}
                >
                  <Icon name="add" size={20} color={BrandColors.primary.orange} />
                </TouchableOpacity>
              </View>
              <Text style={styles.itemPrice}>
                ₹{item.price * (item.quantity || 1)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Delivery Address */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery Address</Text>
        {addresses.length === 0 ? (
          <TouchableOpacity
            style={styles.addAddressButton}
            onPress={() => {
              navigation.navigate('AddressSelection' as never, {
                bookingData: { type: 'meal_order' },
              } as never);
            }}
          >
            <Icon name="add" size={24} color={BrandColors.primary.orange} />
            <Text style={styles.addAddressText}>Add Delivery Address</Text>
          </TouchableOpacity>
        ) : (
          addresses.map((address) => (
            <TouchableOpacity
              key={address.id}
              style={[
                styles.addressCard,
                selectedAddress?.id === address.id && styles.addressCardSelected,
              ]}
              onPress={() => setSelectedAddress(address)}
            >
              <Icon
                name={
                  selectedAddress?.id === address.id
                    ? 'radio-button-checked'
                    : 'radio-button-unchecked'
                }
                size={24}
                color={BrandColors.primary.orange}
              />
              <View style={styles.addressInfo}>
                <Text style={styles.addressText}>{address.address}</Text>
                <Text style={styles.addressDetails}>
                  {address.city}, {address.state} - {address.pincode}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Payment Method */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <TouchableOpacity
          style={[
            styles.paymentOption,
            paymentMethod === 'online' && styles.paymentOptionSelected,
          ]}
          onPress={() => setPaymentMethod('online')}
        >
          <Icon
            name={paymentMethod === 'online' ? 'radio-button-checked' : 'radio-button-unchecked'}
            size={24}
            color={BrandColors.primary.orange}
          />
          <Text style={styles.paymentText}>Online Payment</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.paymentOption, paymentMethod === 'cod' && styles.paymentOptionSelected]}
          onPress={() => setPaymentMethod('cod')}
        >
          <Icon
            name={paymentMethod === 'cod' ? 'radio-button-checked' : 'radio-button-unchecked'}
            size={24}
            color={BrandColors.primary.orange}
          />
          <Text style={styles.paymentText}>Cash on Delivery</Text>
        </TouchableOpacity>
      </View>

      {/* Order Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>₹{total}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Delivery Charges</Text>
          <Text style={styles.summaryValue}>₹50</Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₹{total + 50}</Text>
        </View>
      </View>

      {/* Place Order Button */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.orderButton, (!selectedAddress || ordering) && styles.orderButtonDisabled]}
          onPress={handlePlaceOrder}
          disabled={!selectedAddress || ordering}
        >
          {ordering ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.orderButtonText}>Place Order - ₹{total + 50}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  section: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginBottom: Spacing.md,
  },
  orderItem: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: '#F5F5F5',
    borderRadius: BorderRadius.md,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  itemName: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  itemType: {
    ...Typography.bodyTiny,
    color: BrandColors.primary.orange,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  itemDescription: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
    marginBottom: Spacing.sm,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.primary.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    marginHorizontal: Spacing.md,
    minWidth: 30,
    textAlign: 'center',
  },
  itemPrice: {
    ...Typography.bodyMedium,
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: BrandColors.primary.orange,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
  },
  addAddressText: {
    ...Typography.bodyMedium,
    color: BrandColors.primary.orange,
    marginLeft: Spacing.sm,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  addressCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: '#FFF3E0',
  },
  addressInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  addressText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    marginBottom: Spacing.xs,
  },
  addressDetails: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  paymentOptionSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: '#FFF3E0',
  },
  paymentText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    marginLeft: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    ...Typography.bodyMedium,
    color: BrandColors.text.secondary,
  },
  summaryValue: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
  },
  totalRow: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  totalLabel: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
  },
  totalValue: {
    ...Typography.headingSmall,
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  actionContainer: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  orderButton: {
    backgroundColor: BrandColors.primary.orange,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  orderButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  orderButtonText: {
    ...Typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

