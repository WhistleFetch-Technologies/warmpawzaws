/**
 * Customer Profile Screen - Mobile
 * View and edit customer profile information
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
  Image,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';
import { AddressAutocomplete, type AddressComponents } from '../../components/AddressAutocomplete';

interface CustomerProfileScreenProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  houseNo: string;
  floor: string;
  photo?: string;
}

export function CustomerProfileScreen({
  phone,
  onBack,
  onNavigate,
}: CustomerProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');

  useEffect(() => {
    loadProfile();
  }, [phone]);

  const loadProfile = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await CustomerApi.getCustomerByPhone(phone);
      const customerData = response.customer || response;
      
      let addressLine = '';
      if (typeof customerData.address === 'string') {
        addressLine = customerData.address;
      } else if (customerData.address && typeof customerData.address === 'object') {
        addressLine =
          (customerData.address as any).street ||
          (customerData.address as any).addressLine1 ||
          (customerData.address as any).line1 ||
          '';
      }

      const profileData: UserProfile = {
        firstName: customerData.firstName || customerData.name?.split(' ')[0] || '',
        lastName: customerData.lastName || customerData.name?.split(' ').slice(1).join(' ') || '',
        email: customerData.email || '',
        phone: customerData.phone || phone,
        address: addressLine,
        pincode: customerData.pincode || '',
        city: String(customerData.city || '').trim(),
        state: String(customerData.state || '').trim(),
        houseNo: String(customerData.houseNo ?? customerData.house_no ?? '').trim(),
        floor: String(customerData.floor ?? '').trim(),
        photo: customerData.photo || '',
      };
      
      setProfile(profileData);
      setOriginalProfile(profileData);
      setPhotoPreview(profileData.photo || '');
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    // Validation
    if (!profile.firstName || !profile.lastName || !profile.email || !profile.address || !profile.pincode) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profile.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!/^\d{6}$/.test(profile.pincode)) {
      Alert.alert('Error', 'Please enter a valid 6-digit pincode');
      return;
    }

    const addr = profile.address.trim();
    if (addr && !profile.houseNo.trim()) {
      Alert.alert('Error', 'Please enter House / Flat number when address is set');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string | undefined> = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        address: addr || undefined,
        pincode: profile.pincode,
        city: profile.city.trim() || undefined,
        state: profile.state.trim() || undefined,
        floor: profile.floor.trim() || undefined,
      };
      if (addr) {
        body.houseNo = profile.houseNo.trim();
      }
      if (profile.photo?.startsWith('http')) {
        body.photo = profile.photo;
      }
      await CustomerApi.updateProfile(phone, body);
      await loadProfile(true);
      setEditMode(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (originalProfile) {
      setProfile(originalProfile);
      setPhotoPreview(originalProfile.photo || '');
    }
    setEditMode(false);
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

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={editMode ? handleCancel : onBack}>
          <Text style={styles.backButton}>
            {editMode ? 'Cancel' : '← Back'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {!editMode ? (
          <TouchableOpacity onPress={() => setEditMode(true)}>
            <Text style={styles.editButton}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Photo Section */}
        <View style={styles.photoSection}>
          <View style={styles.photoContainer}>
            {photoPreview ? (
              <Image source={{ uri: photoPreview }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>
                  {profile.firstName.charAt(0).toUpperCase()}
                  {profile.lastName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          {editMode && (
            <TouchableOpacity
              style={styles.changePhotoButton}
              onPress={() => {
                Alert.alert('Upload Photo', 'Photo upload functionality coming soon');
              }}
            >
              <Text style={styles.changePhotoButtonText}>Change Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Form */}
        <View style={styles.formSection}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={[styles.input, !editMode && styles.inputDisabled]}
              value={profile.firstName}
              onChangeText={(text) => setProfile({ ...profile, firstName: text })}
              editable={editMode}
              placeholder="Enter first name"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Last Name *</Text>
            <TextInput
              style={[styles.input, !editMode && styles.inputDisabled]}
              value={profile.lastName}
              onChangeText={(text) => setProfile({ ...profile, lastName: text })}
              editable={editMode}
              placeholder="Enter last name"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={[styles.input, !editMode && styles.inputDisabled]}
              value={profile.email}
              onChangeText={(text) => setProfile({ ...profile, email: text })}
              editable={editMode}
              placeholder="Enter email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={profile.phone}
              editable={false}
              placeholder="Phone number"
            />
            <Text style={styles.helperText}>Phone number cannot be changed</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Address *</Text>
            {editMode ? (
              <AddressAutocomplete
                value={profile.address}
                onChange={(addr: string, components?: AddressComponents) => {
                  setProfile((prev) => {
                    const next = { ...prev, address: addr };
                    if (components?.pincode) {
                      next.pincode = components.pincode.replace(/\D/g, '').slice(0, 6);
                    }
                    if (components?.city) {
                      next.city = components.city;
                    }
                    if (components?.state) {
                      next.state = components.state;
                    }
                    return next;
                  });
                }}
                placeholder="Search address, landmark, city..."
              />
            ) : (
              <TextInput
                style={[styles.input, styles.textArea, styles.inputDisabled]}
                value={profile.address}
                editable={false}
                placeholder="Address"
                multiline
                numberOfLines={3}
              />
            )}
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, styles.formRowItem]}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={[styles.input, !editMode && styles.inputDisabled]}
                value={profile.city}
                onChangeText={(text) => setProfile({ ...profile, city: text })}
                editable={editMode}
                placeholder="City"
              />
            </View>
            <View style={[styles.formGroup, styles.formRowItem]}>
              <Text style={styles.label}>State</Text>
              <TextInput
                style={[styles.input, !editMode && styles.inputDisabled]}
                value={profile.state}
                onChangeText={(text) => setProfile({ ...profile, state: text })}
                editable={editMode}
                placeholder="State"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>House No / Flat No *</Text>
            <TextInput
              style={[styles.input, !editMode && styles.inputDisabled]}
              value={profile.houseNo}
              onChangeText={(text) => setProfile({ ...profile, houseNo: text })}
              editable={editMode}
              placeholder="e.g., A-101"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Floor</Text>
            <TextInput
              style={[styles.input, !editMode && styles.inputDisabled]}
              value={profile.floor}
              onChangeText={(text) => setProfile({ ...profile, floor: text })}
              editable={editMode}
              placeholder="e.g., 1st Floor"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Pincode *</Text>
            <TextInput
              style={[styles.input, !editMode && styles.inputDisabled]}
              value={profile.pincode}
              onChangeText={(text) => setProfile({ ...profile, pincode: text })}
              editable={editMode}
              placeholder="Enter 6-digit pincode"
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>
        </View>

        {/* Quick Actions */}
        {!editMode && (
          <View style={styles.quickActionsSection}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => {
                if (onNavigate) {
                  onNavigate('Settings');
                } else {
                  Alert.alert('Settings', 'Settings screen coming soon');
                }
              }}
            >
              <Text style={styles.quickActionIcon}>⚙️</Text>
              <Text style={styles.quickActionText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => {
                if (onNavigate) {
                  onNavigate('PaymentMethods');
                } else {
                  Alert.alert('Payment Methods', 'Payment methods screen coming soon');
                }
              }}
            >
              <Text style={styles.quickActionIcon}>💳</Text>
              <Text style={styles.quickActionText}>Payment Methods</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => {
                if (onNavigate) {
                  onNavigate('Addresses');
                } else {
                  Alert.alert('Addresses', 'Addresses screen coming soon');
                }
              }}
            >
              <Text style={styles.quickActionIcon}>📍</Text>
              <Text style={styles.quickActionText}>Saved Addresses</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
  editButton: {
    fontSize: typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  saveButton: {
    fontSize: typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  photoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.gray['200'],
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 4,
    borderColor: colors.primary,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  photoPlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.white,
  },
  changePhotoButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  changePhotoButtonText: {
    fontSize: typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  formSection: {
    marginBottom: spacing.xl,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  formRowItem: {
    flex: 1,
  },
  label: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
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
  inputDisabled: {
    backgroundColor: colors.gray['100'],
    color: colors.textSecondary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  quickActionsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  quickActionButton: {
    width: '30%',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  quickActionText: {
    fontSize: typography.caption,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
  },
});

