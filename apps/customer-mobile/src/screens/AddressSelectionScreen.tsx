/**
 * Address Selection Screen - Customer Mobile App
 * Select or add address for home services
 * Matches web app AddressSelector
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
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface Address {
  id: string;
  label: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  isDefault?: boolean;
  lat?: number;
  lng?: number;
}

interface AddressSelectionScreenProps {
  route?: {
    params?: {
      bookingData?: any;
    };
  };
  navigation?: any;
}

export default function AddressSelectionScreen({
  route,
  navigation,
}: AddressSelectionScreenProps) {
  const { user } = useAuth();
  const bookingData = route?.params?.bookingData || {};

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddress, setNewAddress] = useState<Partial<Address>>({
    label: 'Home',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
  });

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const phone = user?.phone?.replace(/[^0-9]/g, '') || '';
      
      if (!phone) {
        Alert.alert('Error', 'User phone number not found');
        return;
      }

      // TODO: Implement API call to fetch saved addresses
      // For now, using placeholder
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/addresses?phone=${phone}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAddresses(data.addresses || []);
        
        // Auto-select default address
        const defaultAddr = data.addresses?.find((a: Address) => a.isDefault);
        if (defaultAddr) {
          setSelectedAddress(defaultAddr);
        }
      } else {
        // Placeholder addresses for development
        setAddresses([]);
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNewAddress = async () => {
    // Validate required fields
    if (!newAddress.addressLine1 || !newAddress.city || !newAddress.pincode) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    try {
      const phone = user?.phone?.replace(/[^0-9]/g, '') || '';
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/addresses`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            phone,
            address: newAddress,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const savedAddress = data.address;
        setAddresses([...addresses, savedAddress]);
        setSelectedAddress(savedAddress);
        setShowAddForm(false);
        setNewAddress({
          label: 'Home',
          addressLine1: '',
          addressLine2: '',
          city: '',
          state: '',
          pincode: '',
          landmark: '',
        });
        Alert.alert('Success', 'Address saved successfully');
      } else {
        Alert.alert('Error', 'Failed to save address');
      }
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Cannot connect to server');
    }
  };

  const handleContinue = () => {
    if (!selectedAddress) {
      Alert.alert('Select Address', 'Please select or add an address');
      return;
    }

    // Navigate to payment with updated booking data
    navigation?.navigate('Payment', {
      bookingData: {
        ...bookingData,
        address: selectedAddress,
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading addresses...
        </Text>
      </View>
    );
  }

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
            <Text style={[Typography.h2, styles.headerTitle]}>Select Address</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              Choose delivery address for home service
            </Text>
          </View>
        </View>

        {/* Saved Addresses */}
        {!showAddForm && (
          <>
            {addresses.length > 0 && (
              <View style={styles.section}>
                <Text style={[Typography.h3, styles.sectionTitle]}>Saved Addresses</Text>
                <View style={styles.addressesList}>
                  {addresses.map((address) => {
                    const isSelected = selectedAddress?.id === address.id;
                    return (
                      <TouchableOpacity
                        key={address.id}
                        style={[
                          styles.addressCard,
                          isSelected && styles.addressCardSelected,
                        ]}
                        onPress={() => setSelectedAddress(address)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.addressHeader}>
                          <View style={styles.addressLeft}>
                            <Icon
                              name="location-on"
                              size={24}
                              color={isSelected ? BrandColors.primary.orange : BrandColors.neutral.gray600}
                            />
                            <View style={styles.addressInfo}>
                              <Text style={[Typography.body, styles.addressLabel]}>
                                {address.label}
                                {address.isDefault && (
                                  <Text style={[Typography.bodyTiny, styles.defaultBadge]}>
                                    {' '}Default
                                  </Text>
                                )}
                              </Text>
                              <Text style={[Typography.bodySmall, styles.addressText]}>
                                {address.addressLine1}
                                {address.addressLine2 && `, ${address.addressLine2}`}
                              </Text>
                              <Text style={[Typography.bodySmall, styles.addressText]}>
                                {address.city}, {address.state} - {address.pincode}
                              </Text>
                              {address.landmark && (
                                <Text style={[Typography.bodyTiny, styles.landmark]}>
                                  Landmark: {address.landmark}
                                </Text>
                              )}
                            </View>
                          </View>
                          <View
                            style={[
                              styles.checkbox,
                              isSelected && styles.checkboxSelected,
                            ]}
                          >
                            {isSelected && (
                              <Icon name="check" size={20} color="#FFFFFF" />
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Add New Address Button */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddForm(true)}
                activeOpacity={0.7}
              >
                <Icon name="add" size={24} color={BrandColors.primary.orange} />
                <Text style={[Typography.body, styles.addButtonText]}>
                  Add New Address
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Add Address Form */}
        {showAddForm && (
          <View style={styles.section}>
            <View style={styles.formHeader}>
              <Text style={[Typography.h3, styles.sectionTitle]}>Add New Address</Text>
              <TouchableOpacity onPress={() => setShowAddForm(false)}>
                <Icon name="close" size={24} color={BrandColors.neutral.gray600} />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <View style={styles.formGroup}>
                <Text style={[Typography.bodySmall, styles.label]}>
                  Label <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Home, Office, etc."
                  placeholderTextColor={BrandColors.neutral.gray400}
                  value={newAddress.label}
                  onChangeText={(text) => setNewAddress({ ...newAddress, label: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[Typography.bodySmall, styles.label]}>
                  Address Line 1 <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="House/Flat No., Building Name"
                  placeholderTextColor={BrandColors.neutral.gray400}
                  value={newAddress.addressLine1}
                  onChangeText={(text) => setNewAddress({ ...newAddress, addressLine1: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[Typography.bodySmall, styles.label]}>Address Line 2</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Street, Area"
                  placeholderTextColor={BrandColors.neutral.gray400}
                  value={newAddress.addressLine2}
                  onChangeText={(text) => setNewAddress({ ...newAddress, addressLine2: text })}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[Typography.bodySmall, styles.label]}>
                    City <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="City"
                    placeholderTextColor={BrandColors.neutral.gray400}
                    value={newAddress.city}
                    onChangeText={(text) => setNewAddress({ ...newAddress, city: text })}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[Typography.bodySmall, styles.label]}>
                    State <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="State"
                    placeholderTextColor={BrandColors.neutral.gray400}
                    value={newAddress.state}
                    onChangeText={(text) => setNewAddress({ ...newAddress, state: text })}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[Typography.bodySmall, styles.label]}>
                  Pincode <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Pincode"
                  placeholderTextColor={BrandColors.neutral.gray400}
                  value={newAddress.pincode}
                  onChangeText={(text) => setNewAddress({ ...newAddress, pincode: text.replace(/[^0-9]/g, '') })}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[Typography.bodySmall, styles.label]}>Landmark</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nearby landmark (optional)"
                  placeholderTextColor={BrandColors.neutral.gray400}
                  value={newAddress.landmark}
                  onChangeText={(text) => setNewAddress({ ...newAddress, landmark: text })}
                />
              </View>

              <BrandedButton
                title="Save Address"
                onPress={handleSaveNewAddress}
                fullWidth
                style={styles.saveButton}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Continue Button */}
      {!showAddForm && (
        <View style={styles.footer}>
          <BrandedButton
            title={selectedAddress ? 'Continue' : 'Select an Address'}
            onPress={handleContinue}
            disabled={!selectedAddress}
            fullWidth
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl + 80,
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
  addressesList: {
    gap: Spacing.base,
  },
  addressCard: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
  },
  addressCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  addressLeft: {
    flexDirection: 'row',
    gap: Spacing.base,
    flex: 1,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  defaultBadge: {
    color: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '20',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  addressText: {
    color: BrandColors.neutral.gray700,
    marginBottom: Spacing.xs,
  },
  landmark: {
    color: BrandColors.neutral.gray500,
    marginTop: Spacing.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: BrandColors.primary.orange,
    borderColor: BrandColors.primary.orange,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: BrandColors.primary.orange,
    borderStyle: 'dashed',
  },
  addButtonText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  form: {
    gap: Spacing.base,
  },
  formGroup: {
    marginBottom: Spacing.base,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  label: {
    color: BrandColors.neutral.gray700,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  required: {
    color: BrandColors.semantic.error,
  },
  input: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
  },
  saveButton: {
    marginTop: Spacing.base,
  },
  footer: {
    padding: Spacing.lg,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
});

