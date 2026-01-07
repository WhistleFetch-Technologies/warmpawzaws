/**
 * Edit Address Screen - Mobile
 * Edit existing address
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
import * as Location from 'expo-location';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface EditAddressScreenProps {
  addressId: string;
  address?: any;
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: () => void;
}

export function EditAddressScreen({
  addressId,
  address: initialAddress,
  phone,
  customerId,
  onBack,
  onNavigate,
  onSuccess,
}: EditAddressScreenProps) {
  const [name, setName] = useState(initialAddress?.name || '');
  const [address, setAddress] = useState(initialAddress?.address || '');
  const [city, setCity] = useState(initialAddress?.city || '');
  const [state, setState] = useState(initialAddress?.state || '');
  const [pincode, setPincode] = useState(initialAddress?.pincode || '');
  const [landmark, setLandmark] = useState(initialAddress?.landmark || '');
  const [isDefault, setIsDefault] = useState(initialAddress?.isDefault || false);
  const [loading, setLoading] = useState(!initialAddress);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initialAddress) {
      loadAddress();
    }
  }, []);

  const loadAddress = async () => {
    try {
      setLoading(true);
      if (addressId && customerId) {
        const addresses = await CustomerApi.getAddresses(customerId);
        const addressesData = Array.isArray(addresses) ? addresses : (addresses as any).addresses || [];
        const address = addressesData.find((a: any) => a.id === addressId);
        if (address) {
          setFormData({
            label: address.label || address.name || 'Home',
            name: address.name || '',
            phone: address.phone || '',
            addressLine1: address.addressLine1 || address.address || '',
            addressLine2: address.addressLine2 || '',
            city: address.city || '',
            state: address.state || '',
            pincode: address.pincode || '',
            landmark: address.landmark || '',
            isDefault: address.isDefault || false,
          });
        }
      }
    } catch (error) {
      console.error('Error loading address:', error);
      Alert.alert('Error', 'Failed to load address');
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }

      const location = await Location.getCurrentPositionAsync();
      // TODO: Reverse geocode to get address
      Alert.alert('Location', 'Location detected. Address auto-fill coming soon.');
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !address.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      await CustomerApi.updateAddress(addressId, {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        landmark: landmark.trim(),
        isDefault,
      });

      Alert.alert('Success', 'Address updated successfully', [
        {
          text: 'OK',
          onPress: () => {
            if (onSuccess) {
              onSuccess();
            } else {
              onBack();
            }
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error updating address:', error);
      Alert.alert('Error', error.message || 'Failed to update address');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
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
              await CustomerApi.deleteAddress(addressId);
              Alert.alert('Success', 'Address deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => {
                    if (onSuccess) {
                      onSuccess();
                    } else {
                      onBack();
                    }
                  },
                },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete address');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Address</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Use Current Location */}
        <TouchableOpacity
          style={styles.locationButton}
          onPress={handleUseCurrentLocation}
        >
          <Text style={styles.locationButtonIcon}>📍</Text>
          <Text style={styles.locationButtonText}>Use Current Location</Text>
        </TouchableOpacity>

        {/* Address Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address Label *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Home, Office"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter full address"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>City *</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="City"
              />
            </View>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>State *</Text>
              <TextInput
                style={styles.input}
                value={state}
                onChangeText={setState}
                placeholder="State"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Pincode *</Text>
              <TextInput
                style={styles.input}
                value={pincode}
                onChangeText={setPincode}
                placeholder="Pincode"
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Landmark</Text>
              <TextInput
                style={styles.input}
                value={landmark}
                onChangeText={setLandmark}
                placeholder="Landmark (optional)"
              />
            </View>
          </View>

          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setIsDefault(!isDefault)}
            >
              <View style={[styles.checkboxBox, isDefault && styles.checkboxBoxChecked]}>
                {isDefault && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Set as default address</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
          >
            <Text style={styles.deleteButtonText}>Delete Address</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
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
    backgroundColor: '#fff',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  locationButtonIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  form: {
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  checkboxContainer: {
    marginTop: spacing.md,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: colors.text,
  },
  actions: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

