/**
 * Add Staff Screen - Vendor Mobile App
 * Form to add new staff members
 * Matches web app StaffFormModal
 */

import React, { useState } from 'react';
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

interface AddStaffScreenProps {
  route?: {
    params?: {
      mode?: 'create' | 'edit';
      staffId?: string;
    };
  };
  navigation?: any;
}

export default function AddStaffScreen({
  route,
  navigation,
}: AddStaffScreenProps) {
  const { vendor } = useAuth();
  const mode = route?.params?.mode || 'create';
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'Staff',
    roleType: 'general',
    degree: '',
    experience: '',
    bio: '',
    consultationFee: '',
    specializations: [] as string[],
    newSpecialization: '',
  });

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

  const handleAddSpecialization = () => {
    if (formData.newSpecialization.trim() && !formData.specializations.includes(formData.newSpecialization.trim())) {
      setFormData({
        ...formData,
        specializations: [...formData.specializations, formData.newSpecialization.trim()],
        newSpecialization: '',
      });
    }
  };

  const handleRemoveSpecialization = (spec: string) => {
    setFormData({
      ...formData,
      specializations: formData.specializations.filter(s => s !== spec),
    });
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.fullName || !formData.phone || !formData.email) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        vendorId: vendor?.id,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        roleType: formData.roleType,
        degree: formData.degree,
        experience: parseInt(formData.experience) || 0,
        bio: formData.bio,
        consultationFee: parseFloat(formData.consultationFee) || 0,
        specializations: formData.specializations,
        photo: photo || '',
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        Alert.alert('Success', 'Staff member added successfully');
        if (navigation) {
          navigation.goBack();
        }
      } else {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to add staff member');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add staff member');
    } finally {
      setSaving(false);
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
          <Text style={[Typography.h2, styles.title]}>
            Add Staff Member
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Photo Upload */}
          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Profile Photo</Text>
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
              Full Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={formData.fullName}
              onChangeText={(text) => setFormData({ ...formData, fullName: text })}
              placeholder="Enter full name"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              Email <Text style={styles.required}>*</Text>
            </Text>
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

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              Phone <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text.replace(/[^0-9+]/g, '') })}
              placeholder="+91 XXXXX XXXXX"
              keyboardType="phone-pad"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Role</Text>
            <TextInput
              style={styles.input}
              value={formData.role}
              onChangeText={(text) => setFormData({ ...formData, role: text })}
              placeholder="e.g., Doctor, Groomer, Trainer"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Degree/Qualifications</Text>
            <TextInput
              style={styles.input}
              value={formData.degree}
              onChangeText={(text) => setFormData({ ...formData, degree: text })}
              placeholder="e.g., BVSc, M.V.Sc"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Years of Experience</Text>
            <TextInput
              style={styles.input}
              value={formData.experience}
              onChangeText={(text) => setFormData({ ...formData, experience: text.replace(/[^0-9]/g, '') })}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Consultation Fee (₹)</Text>
            <TextInput
              style={styles.input}
              value={formData.consultationFee}
              onChangeText={(text) => setFormData({ ...formData, consultationFee: text.replace(/[^0-9.]/g, '') })}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Bio/About</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.bio}
              onChangeText={(text) => setFormData({ ...formData, bio: text })}
              placeholder="Tell us about this staff member..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          {/* Specializations */}
          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Specializations</Text>
            <View style={styles.tagsContainer}>
              {formData.specializations.map((spec, idx) => (
                <View key={idx} style={styles.tag}>
                  <Text style={[Typography.bodyTiny, styles.tagText]}>{spec}</Text>
                  <TouchableOpacity onPress={() => handleRemoveSpecialization(spec)}>
                    <Icon name="close" size={16} color={BrandColors.neutral.gray600} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={styles.addInputContainer}>
              <TextInput
                style={[styles.input, styles.addInput]}
                value={formData.newSpecialization}
                onChangeText={(text) => setFormData({ ...formData, newSpecialization: text })}
                placeholder="Add specialization"
                placeholderTextColor={BrandColors.neutral.gray400}
                onSubmitEditing={handleAddSpecialization}
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddSpecialization}
              >
                <Icon name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <BrandedButton
            title={saving ? 'Adding...' : 'Add Staff Member'}
            onPress={handleSubmit}
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
  textArea: {
    minHeight: 100,
    paddingTop: Spacing.base,
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
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.neutral.gray100,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  tagText: {
    color: BrandColors.neutral.gray700,
  },
  addInputContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  addInput: {
    flex: 1,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.primary.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsContainer: {
    padding: Spacing.lg,
    gap: Spacing.base,
  },
});

