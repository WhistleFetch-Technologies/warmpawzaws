/**
 * Medicine Order Screen - Customer Mobile App
 * Review order, select delivery address, and payment
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
import { BrandedButton } from '../../components/BrandedButton';
import ErrorHandler from '../../utils/errorHandler';

interface MedicineItem {
  medicineId: string;
  quantity: number;
  medicine?: {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
  };
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

export default function MedicineOrderScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { medicines } = route.params as { medicines: MedicineItem[] };

  const [medicineItems, setMedicineItems] = useState<MedicineItem[]>(medicines);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('online');

  useEffect(() => {
    loadMedicineDetails();
    loadAddresses();
  }, []);

  const loadMedicineDetails = async () => {
    try {
      setLoading(true);
      const itemsWithDetails = await Promise.all(
        medicines.map(async (item) => {
          try {
            const response = await fetch(`${API_BASE_URL}/medicine/catalog/${item.medicineId}`, {
              headers: {
                Authorization: `Bearer ${getPublicAnonKey()}`,
              },
            });

            if (response.ok) {
              const data = await response.json();
              return { ...item, medicine: data.medicine };
            }
            return item;
          } catch (error) {
            console.error(`Error loading medicine ${item.medicineId}:`, error);
            return item;
          }
        })
      );

      setMedicineItems(itemsWithDetails);
    } catch (error) {
      ErrorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const loadAddresses = async () => {
    try {
      // Load customer addresses
      if (user?.id) {
        const customer = await fetch(`${API_BASE_URL}/customer/${user.id}`, {
          headers: {
            Authorization: `Bearer ${getPublicAnonKey()}`,
          },
        });

        if (customer.ok) {
          const data = await customer.json();
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

  const calculateTotal = () => {
    return medicineItems.reduce((total, item) => {
      const price = item.medicine?.price || 0;
      return total + price * item.quantity;
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
        customerId: user?.id,
        customerPhone: user?.phone,
        items: medicineItems.map((item) => ({
          medicineId: item.medicineId,
          quantity: item.quantity,
          price: item.medicine?.price || 0,
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

      const response = await fetch(`${API_BASE_URL}/medicine/catalog/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
        body: JSON.stringify(orderData),
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert('Order Placed', 'Your order has been placed successfully!', [
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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
      </View>
    );
  }

  const total = calculateTotal();

  return (
    <ScrollView style={styles.container}>
      {/* Order Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Items</Text>
        {medicineItems.map((item, index) => (
          <View key={index} style={styles.orderItem}>
            <Text style={styles.itemName}>{item.medicine?.name || 'Medicine'}</Text>
            <View style={styles.itemDetails}>
              <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
              <Text style={styles.itemPrice}>
                ₹{(item.medicine?.price || 0) * item.quantity}
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
              // Navigate to add address screen
              navigation.navigate('AddressSelection' as never, {
                bookingData: { type: 'medicine_order' },
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
                name={selectedAddress?.id === address.id ? 'radio-button-checked' : 'radio-button-unchecked'}
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
          style={[styles.paymentOption, paymentMethod === 'online' && styles.paymentOptionSelected]}
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
        <BrandedButton
          title={ordering ? 'Placing Order...' : `Place Order - ₹${total + 50}`}
          onPress={handlePlaceOrder}
          disabled={ordering || !selectedAddress}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: Spacing.sm,
  },
  itemName: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    marginBottom: Spacing.xs,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemQuantity: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
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
});

