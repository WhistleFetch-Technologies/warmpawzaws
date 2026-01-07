/**
 * Addresses Screen - Mobile
 * Manage saved delivery addresses
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
  Modal,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface AddressesScreenProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface Address {
  id: string;
  label: 'Home' | 'Work' | 'Other';
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  isDefault: boolean;
  createdAt: string;
}

export function AddressesScreen({
  phone,
  onBack,
  onNavigate,
}: AddressesScreenProps) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);

  const [addressForm, setAddressForm] = useState({
    label: 'Home' as 'Home' | 'Work' | 'Other',
    name: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    isDefault: false,
  });

  useEffect(() => {
    loadAddresses();
  }, [phone]);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      // ✅ FIX: Use actual API call instead of mock data
      if (phone) {
        // Get customerId from phone if needed
        const customerData = await CustomerApi.getCustomerByPhone(phone);
        const customerId = (customerData as any).id || (customerData as any).customerId;
        if (customerId) {
          const response = await CustomerApi.getAddresses(customerId);
          const addressesData = Array.isArray(response) ? response : (response as any).addresses || [];
          setAddresses(addressesData);
        }
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
      // Set empty array on error instead of showing alert
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = () => {
    setEditingAddress(null);
    setAddressForm({
      label: 'Home',
      name: '',
      phone: phone,
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      pincode: '',
      landmark: '',
      isDefault: addresses.length === 0,
    });
    setShowAddModal(true);
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setAddressForm({
      label: address.label,
      name: address.name,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      landmark: address.landmark || '',
      isDefault: address.isDefault,
    });
    setShowAddModal(true);
  };

  const handleSaveAddress = async () => {
    // Validation
    if (
      !addressForm.name ||
      !addressForm.phone ||
      !addressForm.addressLine1 ||
      !addressForm.city ||
      !addressForm.state ||
      !addressForm.pincode
    ) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    if (!/^\d{6}$/.test(addressForm.pincode)) {
      Alert.alert('Error', 'Please enter a valid 6-digit pincode');
      return;
    }

    if (!/^\d{10}$/.test(addressForm.phone.replace(/\D/g, ''))) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setSaving(true);
      const addressData = {
        ...addressForm,
        phone: addressForm.phone.replace(/\D/g, ''),
      };

      // ✅ FIX: Use actual API call instead of mock
      if (editingAddress) {
        await CustomerApi.updateAddress(editingAddress.id, {
          ...addressData,
          customerId: phone // Use phone as customerId if needed
        });
      } else {
        await CustomerApi.addAddress({
          ...addressData,
          customerId: phone // Use phone as customerId if needed
        });
      }

      Alert.alert(
        'Success',
        editingAddress ? 'Address updated successfully!' : 'Address added successfully!'
      );
      setShowAddModal(false);
      setEditingAddress(null);
      loadAddresses();
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Failed to save address. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = (addressId: string) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // ✅ FIX: Use actual API call instead of mock
              await CustomerApi.deleteAddress(addressId);
              Alert.alert('Success', 'Address deleted');
              loadAddresses();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete address');
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      if (customerId) {
        await CustomerApi.setDefaultAddress(customerId, addressId);
        Alert.alert('Success', 'Default address updated');
        loadAddresses();
      } else {
        Alert.alert('Error', 'Customer ID required');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update default address');
    }
  };

  const getAddressIcon = (label: string) => {
    switch (label) {
      case 'Home':
        return '🏠';
      case 'Work':
        return '🏢';
      case 'Other':
        return '📍';
      default:
        return '📍';
    }
  };

  const indianStates = [
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chhattisgarh',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal',
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Addresses</Text>
        <TouchableOpacity onPress={handleAddAddress}>
          <Text style={styles.addButton}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {addresses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>📍</Text>
              <Text style={styles.emptyStateText}>No addresses saved</Text>
              <Text style={styles.emptyStateSubtext}>
                Add an address for faster checkout
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={handleAddAddress}
              >
                <Text style={styles.emptyStateButtonText}>Add Address</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.addressesList}>
              {addresses.map((address) => (
                <View key={address.id} style={styles.addressCard}>
                  <View style={styles.addressHeader}>
                    <View style={styles.addressInfo}>
                      <Text style={styles.addressIcon}>
                        {getAddressIcon(address.label)}
                      </Text>
                      <View style={styles.addressDetails}>
                        <View style={styles.addressTitleRow}>
                          <Text style={styles.addressLabel}>
                            {address.label}
                          </Text>
                          {address.isDefault && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>
                                Default
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.addressName}>{address.name}</Text>
                        <Text style={styles.addressPhone}>{address.phone}</Text>
                        <Text style={styles.addressText}>
                          {address.addressLine1}
                        </Text>
                        {address.addressLine2 && (
                          <Text style={styles.addressText}>
                            {address.addressLine2}
                          </Text>
                        )}
                        {address.landmark && (
                          <Text style={styles.addressText}>
                            Landmark: {address.landmark}
                          </Text>
                        )}
                        <Text style={styles.addressText}>
                          {address.city}, {address.state} - {address.pincode}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.addressActions}>
                    {!address.isDefault && (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleSetDefault(address.id)}
                      >
                        <Text style={styles.actionButtonText}>
                          Set as Default
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEditAddress(address)}
                    >
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteAddress(address.id)}
                    >
                      <Text
                        style={[styles.actionButtonText, styles.deleteButtonText]}
                      >
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Add/Edit Address Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowAddModal(false);
          setEditingAddress(null);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAddress ? 'Edit Address' : 'Add New Address'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  setEditingAddress(null);
                }}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Address Label */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Address Type *</Text>
                <View style={styles.labelSelector}>
                  {(['Home', 'Work', 'Other'] as const).map((label) => (
                    <TouchableOpacity
                      key={label}
                      style={[
                        styles.labelButton,
                        addressForm.label === label &&
                          styles.labelButtonActive,
                      ]}
                      onPress={() =>
                        setAddressForm({ ...addressForm, label })
                      }
                    >
                      <Text
                        style={[
                          styles.labelButtonText,
                          addressForm.label === label &&
                            styles.labelButtonTextActive,
                        ]}
                      >
                        {getAddressIcon(label)} {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Name */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={addressForm.name}
                  onChangeText={(text) =>
                    setAddressForm({ ...addressForm, name: text })
                  }
                  placeholder="Enter name"
                />
              </View>

              {/* Phone */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Phone *</Text>
                <TextInput
                  style={styles.input}
                  value={addressForm.phone}
                  onChangeText={(text) =>
                    setAddressForm({
                      ...addressForm,
                      phone: text.replace(/\D/g, '').slice(0, 10),
                    })
                  }
                  placeholder="Enter 10-digit phone number"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              {/* Address Line 1 */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Address Line 1 *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={addressForm.addressLine1}
                  onChangeText={(text) =>
                    setAddressForm({ ...addressForm, addressLine1: text })
                  }
                  placeholder="House/Flat No., Building Name"
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Address Line 2 */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Address Line 2</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={addressForm.addressLine2}
                  onChangeText={(text) =>
                    setAddressForm({ ...addressForm, addressLine2: text })
                  }
                  placeholder="Street, Area, Colony"
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Landmark */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Landmark</Text>
                <TextInput
                  style={styles.input}
                  value={addressForm.landmark}
                  onChangeText={(text) =>
                    setAddressForm({ ...addressForm, landmark: text })
                  }
                  placeholder="Nearby landmark (optional)"
                />
              </View>

              {/* City */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>City *</Text>
                <TextInput
                  style={styles.input}
                  value={addressForm.city}
                  onChangeText={(text) =>
                    setAddressForm({ ...addressForm, city: text })
                  }
                  placeholder="Enter city"
                />
              </View>

              {/* State */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>State *</Text>
                <ScrollView style={styles.stateList}>
                  {indianStates.map((state) => (
                    <TouchableOpacity
                      key={state}
                      style={[
                        styles.stateItem,
                        addressForm.state === state && styles.stateItemSelected,
                      ]}
                      onPress={() =>
                        setAddressForm({ ...addressForm, state })
                      }
                    >
                      <Text
                        style={[
                          styles.stateItemText,
                          addressForm.state === state &&
                            styles.stateItemTextSelected,
                        ]}
                      >
                        {state}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Pincode */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Pincode *</Text>
                <TextInput
                  style={styles.input}
                  value={addressForm.pincode}
                  onChangeText={(text) =>
                    setAddressForm({
                      ...addressForm,
                      pincode: text.replace(/\D/g, '').slice(0, 6),
                    })
                  }
                  placeholder="Enter 6-digit pincode"
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              {/* Set as Default */}
              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() =>
                    setAddressForm({
                      ...addressForm,
                      isDefault: !addressForm.isDefault,
                    })
                  }
                >
                  <Text style={styles.checkboxIcon}>
                    {addressForm.isDefault ? '✓' : ''}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>
                  Set as default address
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowAddModal(false);
                  setEditingAddress(null);
                }}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSaveAddress}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalButtonTextPrimary}>
                    {editingAddress ? 'Update' : 'Save'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  backButton: {
    fontSize: typography.body,
    color: colors.white,
  },
  headerTitle: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.white,
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    fontSize: typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyStateText: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  emptyStateButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  emptyStateButtonText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  addressesList: {
    gap: spacing.md,
  },
  addressCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  addressHeader: {
    marginBottom: spacing.md,
  },
  addressInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  addressDetails: {
    flex: 1,
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  addressLabel: {
    fontSize: typography.body,
    fontWeight: 'bold',
    color: colors.text,
    marginRight: spacing.sm,
  },
  defaultBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  defaultBadgeText: {
    fontSize: typography.caption,
    color: colors.white,
    fontWeight: 'bold',
  },
  addressName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  addressPhone: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  addressText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  addressActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray['200'],
  },
  actionButton: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray['200'],
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  deleteButton: {
    borderColor: '#EF4444',
  },
  deleteButtonText: {
    color: '#EF4444',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray['200'],
  },
  modalTitle: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray['100'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: typography.h2,
    color: colors.text,
  },
  modalBody: {
    padding: spacing.md,
    maxHeight: 500,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  labelSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  labelButton: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: colors.gray['200'],
    alignItems: 'center',
  },
  labelButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.error + 20% opacity,
  },
  labelButtonText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  labelButtonTextActive: {
    color: colors.primary,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
    fontSize: typography.body,
    color: colors.text,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  stateList: {
    maxHeight: 150,
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  stateItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray['200'],
  },
  stateItemSelected: {
    backgroundColor: colors.error + 20% opacity,
  },
  stateItemText: {
    fontSize: typography.body,
    color: colors.text,
  },
  stateItemTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.primary,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  checkboxIcon: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: typography.body,
    color: colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray['200'],
  },
  modalButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonTextSecondary: {
    fontSize: typography.body,
    color: colors.text,
    fontWeight: 'bold',
  },
  modalButtonTextPrimary: {
    fontSize: typography.body,
    color: colors.white,
    fontWeight: 'bold',
  },
});

