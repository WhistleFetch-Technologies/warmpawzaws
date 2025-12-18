/**
 * Edit Profile Screen - Vendor Mobile App
 * Edit vendor profile information
 * Matches web app vendor profile editing
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  StatusBar,
  Platform,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface EditProfileScreenProps {
  route?: {
    params?: {};
  };
  navigation?: any;
}

export default function EditProfileScreen({
  route,
  navigation,
}: EditProfileScreenProps) {
  const { vendor, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    description: '',
  });

  useEffect(() => {
    loadProfile();
  }, [vendor]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      if (vendor?.id) {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/profile?vendorId=${vendor.id}`,
          {
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const profile = data.profile || data;
          
          setFormData({
            businessName: profile.businessName || vendor?.businessName || '',
            ownerName: profile.ownerName || profile.owner_name || '',
            email: profile.email || '',
            phone: profile.phone || vendor?.phone || '',
            address: profile.address || '',
            city: profile.city || '',
            state: profile.state || '',
            pincode: profile.pincode || profile.pin_code || '',
            description: profile.description || profile.bio || '',
          });
          setPhoto(profile.photo || profile.profilePhoto || null);
        }
      } else {
        // Use vendor data from context
        setFormData({
          businessName: vendor?.businessName || '',
          ownerName: vendor?.ownerName || '',
          email: vendor?.email || '',
          phone: vendor?.phone || '',
          address: vendor?.address || '',
          city: vendor?.city || '',
          state: vendor?.state || '',
          pincode: vendor?.pincode || '',
          description: vendor?.description || '',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePickPhoto = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
      },
      (response) => {
        if (response.assets && response.assets[0]) {
          setPhoto(response.assets[0].uri || null);
        }
      }
    );
  };

  const handleSave = async () => {
    if (!formData.businessName || !formData.phone) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        businessName: formData.businessName,
        ownerName: formData.ownerName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        description: formData.description,
        photo: photo || '',
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/profile`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            vendorId: vendor?.id,
            ...payload,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        Alert.alert('Success', 'Profile updated successfully');
        
        // Update context
        if (updateUser) {
          updateUser({
            ...vendor,
            ...payload,
          });
        }
        
        if (navigation) {
          navigation.goBack();
        }
      } else {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to update profile');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading profile...
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
          <Text style={[Typography.h2, styles.title]}>Edit Profile</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Photo Upload */}
          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Business Photo</Text>
            <TouchableOpacity style={styles.photoButton} onPress={handlePickPhoto}>
              {photo ? (
                <Text style={[Typography.body, styles.photoButtonText]}>
                  Photo Selected ✓
                </Text>
              ) : (
                <>
                  <Icon name="add-a-photo" size={32} color={BrandColors.primary.orange} />
                  <Text style={[Typography.body, styles.photoButtonText]}>
                    Upload Photo
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Basic Info */}
          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              Business Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={formData.businessName}
              onChangeText={(text) => setFormData({ ...formData, businessName: text })}
              placeholder="Enter business name"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Owner Name</Text>
            <TextInput
              style={styles.input}
              value={formData.ownerName}
              onChangeText={(text) => setFormData({ ...formData, ownerName: text })}
              placeholder="Enter owner name"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              Phone <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={formData.phone}
              editable={false}
              placeholder="Phone number"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
            <Text style={[Typography.bodyTiny, styles.helpText]}>
              Phone number cannot be changed
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Email</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          {/* Address */}
          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.address}
              onChangeText={(text) => setFormData({ ...formData, address: text })}
              placeholder="Enter business address"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, styles.formGroupHalf]}>
              <Text style={[Typography.bodySmall, styles.label]}>City</Text>
              <TextInput
                style={styles.input}
                value={formData.city}
                onChangeText={(text) => setFormData({ ...formData, city: text })}
                placeholder="City"
                placeholderTextColor={BrandColors.neutral.gray400}
              />
            </View>

            <View style={[styles.formGroup, styles.formGroupHalf]}>
              <Text style={[Typography.bodySmall, styles.label]}>State</Text>
              <TextInput
                style={styles.input}
                value={formData.state}
                onChangeText={(text) => setFormData({ ...formData, state: text })}
                placeholder="State"
                placeholderTextColor={BrandColors.neutral.gray400}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Pincode</Text>
            <TextInput
              style={styles.input}
              value={formData.pincode}
              onChangeText={(text) => setFormData({ ...formData, pincode: text.replace(/[^0-9]/g, '').slice(0, 6) })}
              placeholder="123456"
              keyboardType="numeric"
              maxLength={6}
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Tell customers about your business..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <BrandedButton
            title={saving ? 'Saving...' : 'Save Changes'}
            onPress={handleSave}
            disabled={saving}
            loading={saving}
            fullWidth
          />
        </View>
      </ScrollView>
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
    paddingBottom: Spacing.xl,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  title: {
    color: BrandColors.neutral.gray900,
  },
  form: {
    padding: Spacing.lg,
  },
  formGroup: {
    marginBottom: Spacing.base,
  },
  formGroupHalf: {
    flex: 1,
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
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray300,
    borderRadius: BorderRadius.sm,
    padding: Spacing.base,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    backgroundColor: BrandColors.neutral.white,
  },
  inputDisabled: {
    backgroundColor: BrandColors.neutral.gray100,
    color: BrandColors.neutral.gray600,
  },
  textArea: {
    minHeight: 100,
    paddingTop: Spacing.base,
  },
  helpText: {
    color: BrandColors.neutral.gray500,
    marginTop: Spacing.xs,
  },
  photoButton: {
    borderWidth: 2,
    borderColor: BrandColors.primary.orange,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  photoButtonText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  actionsContainer: {
    padding: Spacing.lg,
    gap: Spacing.base,
  },
});

