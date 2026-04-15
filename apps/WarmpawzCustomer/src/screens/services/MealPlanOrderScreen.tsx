/**
 * Meal Plan Order Screen - Mobile
 * Handles meal plan selection and ordering with delivery
 * Identical functionality to web app
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
import { CustomerApi, PaymentApi } from '../../services/api';
import RazorpayCheckout from 'react-native-razorpay';

interface MealPlanOrderScreenProps {
  vendorId: string;
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (orderId: string) => void;
}

interface MealPlan {
  id: string;
  name: string;
  description: string;
  pet_types: string[];
  duration_days: number;
  meals_per_day: number;
  price: number;
  is_active: boolean;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
}

interface Address {
  id: string;
  label: string;
  address: string;
  city: string;
  pincode: string;
}

export function MealPlanOrderScreen({
  vendorId,
  phone,
  customerId,
  onBack,
  onNavigate,
  onSuccess,
}: MealPlanOrderScreenProps) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<string>('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    loadData();
  }, [vendorId, phone, customerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansRes, customerRes] = await Promise.all([
        CustomerApi.getServices({ vendorId }).catch(() => ({ services: [] })),
        customerId 
          ? Promise.resolve({ id: customerId })
          : CustomerApi.getCustomerByPhone(phone).catch(() => null),
      ]);

      // Extract meal plans from services or use direct API
      const services = (plansRes as any).services || [];
      const mealPlanServices = services.filter((s: any) => 
        s.category === 'nutrition' || s.serviceType === 'meal_plan'
      );
      
      if (mealPlanServices.length > 0) {
        setMealPlans(mealPlanServices.map((s: any) => ({
          id: s.id,
          name: s.name || s.serviceName,
          description: s.description || '',
          pet_types: s.petTypes || ['Dog', 'Cat'],
          duration_days: s.durationDays || 7,
          meals_per_day: s.mealsPerDay || 2,
          price: s.price || s.basePrice || 0,
          is_active: true,
        })));
      }

      const customer = customerRes as any;
      const finalCustomerId = customer?.id || customerId;

      if (finalCustomerId) {
        const [petsRes, addressesRes] = await Promise.all([
          CustomerApi.getPets(finalCustomerId).catch(() => []),
          CustomerApi.getAddresses(finalCustomerId).catch(() => []),
        ]);

        const petsData = Array.isArray(petsRes) ? petsRes : (petsRes as any).pets || [];
        setPets(petsData.map((p: any) => ({
          id: p.id,
          name: p.name,
          species: p.species || p.type || 'Dog',
          breed: p.breed || '',
        })));

        const addressesData = Array.isArray(addressesRes) ? addressesRes : (addressesRes as any).addresses || [];
        setAddresses(addressesData.map((a: any) => ({
          id: a.id,
          label: a.label || a.name || 'Address',
          address: a.address || a.addressLine1 || '',
          city: a.city || '',
          pincode: a.pincode || '',
        })));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load meal plans');
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = (): number => {
    const plan = mealPlans.find(p => p.id === selectedPlan);
    if (!plan) return 0;
    return plan.price * quantity;
  };

  const handlePlaceOrder = async () => {
    if (!selectedPlan) {
      Alert.alert('Error', 'Please select a meal plan');
      return;
    }

    if (!selectedPet) {
      Alert.alert('Error', 'Please select a pet');
      return;
    }

    if (!selectedAddress) {
      Alert.alert('Error', 'Please select a delivery address');
      return;
    }

    if (!deliveryDate || !deliveryTime) {
      Alert.alert('Error', 'Please select delivery date and time');
      return;
    }

    try {
      setProcessing(true);

      // Get customer ID
      const customer = customerId 
        ? { id: customerId }
        : await CustomerApi.getCustomerByPhone(phone);
      
      const finalCustomerId = customer?.id;

      if (!finalCustomerId) {
        Alert.alert('Error', 'Customer not found. Please try again.');
        return;
      }

      const plan = mealPlans.find(p => p.id === selectedPlan);
      const totalAmount = calculatePrice();

      // Create order
      const orderData = {
        vendorId,
        customerId: finalCustomerId,
        mealPlanId: selectedPlan,
        petId: selectedPet,
        addressId: selectedAddress,
        deliveryDate,
        deliveryTime,
        quantity,
        totalAmount,
        orderType: 'meal_plan_delivery',
      };

      const orderResponse = await CustomerApi.checkout(
        finalCustomerId,
        'razorpay',
        selectedAddress,
        undefined
      ).catch(async () => {
        // Fallback: Create order via nutrition API
        const response = await fetch(`${process.env.API_BASE_URL || ''}/nutrition/delivery-orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
        });
        return response.json();
      });

      const orderId = (orderResponse as any).orderId || (orderResponse as any).order?.id || (orderResponse as any).id;

      if (!orderId) {
        throw new Error('Failed to create order');
      }

      // Handle payment if amount > 0
      if (totalAmount > 0) {
        try {
          // Create Razorpay order
          const orderRes = await PaymentApi.createRazorpayOrder({
            amount: totalAmount,
            currency: 'INR',
            receipt: orderId,
            customerId: finalCustomerId,
            vendorId: vendorId,
          });

          if (!orderRes.order_id) {
            throw new Error('Failed to create payment order');
          }

          // Open Razorpay checkout
          const options = {
            description: `Meal Plan Order - ${plan?.name}`,
            image: 'https://your-logo-url.com/logo.png',
            currency: 'INR',
            key: orderRes.razorpay_key || 'YOUR_RAZORPAY_KEY',
            amount: totalAmount * 100,
            name: 'Warmpawz',
            order_id: orderRes.order_id,
            prefill: {
              contact: phone,
            },
            theme: {
              color: '#FF8C42',
            },
          };

          const razorpayResponse = await RazorpayCheckout.open(options);

          // Verify payment
          await PaymentApi.verifyRazorpayPayment({
            razorpayOrderId: razorpayResponse.razorpay_order_id,
            razorpayPaymentId: razorpayResponse.razorpay_payment_id,
            razorpaySignature: razorpayResponse.razorpay_signature,
            customerId: finalCustomerId,
          });

          Alert.alert('Success', 'Meal plan order placed successfully and payment confirmed!', [
            {
              text: 'View Order',
              onPress: () => {
                if (onNavigate) {
                  onNavigate('OrderDetail', { orderId });
                } else if (onSuccess) {
                  onSuccess(orderId);
                }
              },
            },
            {
              text: 'Track Order',
              onPress: () => {
                if (onNavigate) {
                  onNavigate('OrderTracking', { orderId });
                }
              },
            },
            {
              text: 'OK',
              style: 'cancel',
              onPress: () => {
                if (onSuccess) {
                  onSuccess(orderId);
                } else {
                  onBack();
                }
              },
            },
          ]);
        } catch (paymentError: any) {
          console.error('Payment error:', paymentError);
          if (paymentError.error) {
            if (paymentError.error.code === 'BAD_REQUEST_ERROR') {
              Alert.alert('Payment Failed', paymentError.error.description || 'Payment failed. Please try again.');
            } else {
              Alert.alert('Payment Cancelled', 'Your order has been created but payment was cancelled. Please complete payment later.');
            }
          } else {
            Alert.alert('Payment Error', 'Payment processing failed. Your order is pending payment.');
          }
          // Still show success as order was created
          if (onSuccess) {
            onSuccess(orderId);
          }
        }
      } else {
        // Free order - no payment needed
        Alert.alert('Success', 'Meal plan order placed successfully!', [
          {
            text: 'View Order',
            onPress: () => {
              if (onNavigate) {
                onNavigate('OrderDetail', { orderId });
              } else if (onSuccess) {
                onSuccess(orderId);
              }
            },
          },
          {
            text: 'OK',
            style: 'cancel',
            onPress: () => {
              if (onSuccess) {
                onSuccess(orderId);
              } else {
                onBack();
              }
            },
          },
        ]);
      }
    } catch (error: any) {
      console.error('Error placing order:', error);
      Alert.alert('Error', error.message || 'Failed to place order. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading meal plans...</Text>
        </View>
      </ScreenShell>
    );
  }

  const selectedPlanData = mealPlans.find(p => p.id === selectedPlan);

  return (
    <ScreenShell style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Meal Plan</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Meal Plan Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Meal Plan</Text>
          {mealPlans.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🍲</Text>
              <Text style={styles.emptyText}>No meal plans available</Text>
            </View>
          ) : (
            mealPlans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planCard,
                  selectedPlan === plan.id && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPlan(plan.id)}
              >
                <View style={styles.planInfo}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planDescription}>{plan.description}</Text>
                  <View style={styles.planDetails}>
                    <Text style={styles.planDetail}>{plan.duration_days} days</Text>
                    <Text style={styles.planDetail}>•</Text>
                    <Text style={styles.planDetail}>{plan.meals_per_day} meals/day</Text>
                  </View>
                  <View style={styles.petTypesContainer}>
                    {plan.pet_types.map((type) => (
                      <View key={type} style={styles.petTypeTag}>
                        <Text style={styles.petTypeText}>{type}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.planPriceContainer}>
                  <Text style={styles.planPrice}>₹{plan.price}</Text>
                  {selectedPlan === plan.id && (
                    <Text style={styles.selectedCheck}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Pet Selection */}
        {selectedPlan && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Pet</Text>
            {pets.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No pets found. Please add a pet first.</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {pets
                  .filter(pet => selectedPlanData?.pet_types.includes(pet.species))
                  .map((pet) => (
                    <TouchableOpacity
                      key={pet.id}
                      style={[
                        styles.petCard,
                        selectedPet === pet.id && styles.petCardSelected,
                      ]}
                      onPress={() => setSelectedPet(pet.id)}
                    >
                      <Text style={styles.petName}>{pet.name}</Text>
                      <Text style={styles.petDetails}>{pet.species} • {pet.breed}</Text>
                      {selectedPet === pet.id && (
                        <Text style={styles.selectedCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Delivery Address */}
        {selectedPet && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            {addresses.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No addresses found. Please add an address first.</Text>
                {onNavigate && (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => onNavigate('Addresses')}
                  >
                    <Text style={styles.addButtonText}>+ Add Address</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              addresses.map((address) => (
                <TouchableOpacity
                  key={address.id}
                  style={[
                    styles.addressCard,
                    selectedAddress === address.id && styles.addressCardSelected,
                  ]}
                  onPress={() => setSelectedAddress(address.id)}
                >
                  <Text style={styles.addressLabel}>{address.label}</Text>
                  <Text style={styles.addressText}>{address.address}</Text>
                  <Text style={styles.addressText}>
                    {address.city} {address.pincode}
                  </Text>
                  {selectedAddress === address.id && (
                    <Text style={styles.selectedCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Delivery Date & Time */}
        {selectedAddress && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Date & Time</Text>
            <View style={styles.dateTimeContainer}>
              <View style={styles.dateTimeInput}>
                <Text style={styles.inputLabel}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={deliveryDate}
                  onChangeText={setDeliveryDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={styles.dateTimeInput}>
                <Text style={styles.inputLabel}>Time</Text>
                <TextInput
                  style={styles.input}
                  value={deliveryTime}
                  onChangeText={setDeliveryTime}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
            <View style={styles.quantityContainer}>
              <Text style={styles.inputLabel}>Quantity</Text>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Text style={styles.quantityButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.quantityValue}>{quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => setQuantity(quantity + 1)}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Order Summary */}
        {selectedPlan && selectedPet && selectedAddress && deliveryDate && deliveryTime && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{selectedPlanData?.name} × {quantity}</Text>
              <Text style={styles.summaryValue}>₹{calculatePrice()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery</Text>
              <Text style={styles.summaryValue}>Free</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₹{calculatePrice()}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            (!selectedPlan || !selectedPet || !selectedAddress || !deliveryDate || !deliveryTime || processing) &&
              styles.placeOrderButtonDisabled,
          ]}
          onPress={handlePlaceOrder}
          disabled={!selectedPlan || !selectedPet || !selectedAddress || !deliveryDate || !deliveryTime || processing}
        >
          {processing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.placeOrderButtonText}>
              Place Order • ₹{calculatePrice()}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
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
  planCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  planDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  planDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  planDetail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  petTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  petTypeTag: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  petTypeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  planPriceContainer: {
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  petCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginRight: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    minWidth: 120,
  },
  petCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  petName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  petDetails: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  addressCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  addressCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  addressLabel: {
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
  dateTimeContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateTimeInput: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  quantityContainer: {
    marginTop: spacing.md,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
  },
  quantityButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
  },
  quantityValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
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
    fontWeight: '600',
    color: colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
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
  emptyState: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  addButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  selectedCheck: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: 'bold',
  },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
    fontSize: 18,
    fontWeight: 'bold',
  },
});

