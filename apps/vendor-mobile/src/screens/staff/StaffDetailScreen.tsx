/**
 * Staff Detail Screen - Vendor Mobile App
 * View and edit staff member details
 * Matches web app StaffFormModal
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
  Switch,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface StaffDetailScreenProps {
  route?: {
    params?: {
      staffId: string;
      mode?: 'edit' | 'view';
    };
  };
  navigation?: any;
}

export default function StaffDetailScreen({
  route,
  navigation,
}: StaffDetailScreenProps) {
  const { vendor } = useAuth();
  const staffId = route?.params?.staffId;
  const mode = route?.params?.mode || 'view';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(mode === 'edit');

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
    isActive: true,
  });

  useEffect(() => {
    if (staffId) {
      loadStaffDetails();
    }
  }, [staffId]);

  const loadStaffDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staffId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const staff = data.staff || data;
        
        setFormData({
          fullName: staff.fullName || '',
          email: staff.email || '',
          phone: staff.phone || '',
          role: staff.role || 'Staff',
          roleType: staff.roleType || 'general',
          degree: staff.degree || '',
          experience: (staff.experience || 0).toString(),
          bio: staff.bio || '',
          consultationFee: (staff.consultationFee || 0).toString(),
          specializations: staff.specializations || [],
          newSpecialization: '',
          isActive: staff.isActive !== false,
        });
        setPhoto(staff.photo || null);
      } else {
        throw new Error('Failed to load staff details');
      }
    } catch (error) {
      console.error('Error loading staff:', error);
      Alert.alert('Error', 'Failed to load staff details');
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

  const handleSave = async () => {
    if (!formData.fullName || !formData.phone || !formData.email) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const payload = {
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
        isActive: formData.isActive,
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staffId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        Alert.alert('Success', 'Staff member updated successfully');
        setIsEditMode(false);
        loadStaffDetails(); // Reload to get updated data
      } else {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to update staff member');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Staff Member',
      `Are you sure you want to remove ${formData.fullName}? They will no longer be able to login.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staffId}`,
                {
                  method: 'DELETE',
                  headers: {
                    Authorization: `Bearer ${publicAnonKey}`,
                  },
                }
              );

              if (response.ok) {
                Alert.alert('Success', 'Staff member removed successfully');
                if (navigation) {
                  navigation.goBack();
                }
              } else {
                throw new Error('Failed to delete staff member');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to remove staff member');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading staff details...
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
          <View style={styles.headerRow}>
            <Text style={[Typography.h2, styles.title]}>
              {isEditMode ? 'Edit Staff Member' : 'Staff Details'}
            </Text>
            {!isEditMode && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setIsEditMode(true)}
              >
                <Icon name="edit" size={20} color={BrandColors.primary.orange} />
                <Text style={[Typography.bodySmall, styles.editButtonText]}>
                  Edit
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Photo Upload */}
          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Profile Photo</Text>
            <TouchableOpacity 
              style={styles.photoButton} 
              onPress={isEditMode ? handlePickPhoto : undefined}
              disabled={!isEditMode}
            >
              {photo ? (
                <Text style={[Typography.body, styles.photoButtonText]}>
                  Photo Selected ✓
                </Text>
              ) : (
                <>
                  <Icon name="add-a-photo" size={32} color={BrandColors.primary.orange} />
                  <Text style={[Typography.body, styles.photoButtonText]}>
                    {isEditMode ? 'Upload Photo' : 'No Photo'}
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
              style={[styles.input, !isEditMode && styles.inputDisabled]}
              value={formData.fullName}
              onChangeText={(text) => setFormData({ ...formData, fullName: text })}
              placeholder="Enter full name"
              editable={isEditMode}
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              Email <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, !isEditMode && styles.inputDisabled]}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={isEditMode}
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              Phone <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, !isEditMode && styles.inputDisabled]}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text.replace(/[^0-9+]/g, '') })}
              placeholder="+91 XXXXX XXXXX"
              keyboardType="phone-pad"
              editable={isEditMode}
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Role</Text>
            <TextInput
              style={[styles.input, !isEditMode && styles.inputDisabled]}
              value={formData.role}
              onChangeText={(text) => setFormData({ ...formData, role: text })}
              placeholder="e.g., Doctor, Groomer, Trainer"
              editable={isEditMode}
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Degree/Qualifications</Text>
            <TextInput
              style={[styles.input, !isEditMode && styles.inputDisabled]}
              value={formData.degree}
              onChangeText={(text) => setFormData({ ...formData, degree: text })}
              placeholder="e.g., BVSc, M.V.Sc"
              editable={isEditMode}
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Years of Experience</Text>
            <TextInput
              style={[styles.input, !isEditMode && styles.inputDisabled]}
              value={formData.experience}
              onChangeText={(text) => setFormData({ ...formData, experience: text.replace(/[^0-9]/g, '') })}
              placeholder="0"
              keyboardType="numeric"
              editable={isEditMode}
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Consultation Fee (₹)</Text>
            <TextInput
              style={[styles.input, !isEditMode && styles.inputDisabled]}
              value={formData.consultationFee}
              onChangeText={(text) => setFormData({ ...formData, consultationFee: text.replace(/[^0-9.]/g, '') })}
              placeholder="0"
              keyboardType="numeric"
              editable={isEditMode}
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Bio/About</Text>
            <TextInput
              style={[styles.input, styles.textArea, !isEditMode && styles.inputDisabled]}
              value={formData.bio}
              onChangeText={(text) => setFormData({ ...formData, bio: text })}
              placeholder="Tell us about this staff member..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={isEditMode}
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
                  {isEditMode && (
                    <TouchableOpacity onPress={() => handleRemoveSpecialization(spec)}>
                      <Icon name="close" size={16} color={BrandColors.neutral.gray600} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
            {isEditMode && (
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
            )}
          </View>

          {/* Active Status */}
          <View style={styles.formGroup}>
            <View style={styles.switchRow}>
              <Text style={[Typography.body, styles.label]}>
                Active Status
              </Text>
              <Switch
                value={formData.isActive}
                onValueChange={(value) => setFormData({ ...formData, isActive: value })}
                disabled={!isEditMode}
                trackColor={{
                  false: BrandColors.neutral.gray300,
                  true: BrandColors.primary.orange,
                }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        {isEditMode ? (
          <View style={styles.actionsContainer}>
            <BrandedButton
              title={saving ? 'Saving...' : 'Save Changes'}
              onPress={handleSave}
              disabled={saving}
              loading={saving}
              fullWidth
            />
            <BrandedButton
              title="Cancel"
              onPress={() => {
                setIsEditMode(false);
                loadStaffDetails(); // Reload original data
              }}
              variant="outline"
              fullWidth
            />
            <BrandedButton
              title="Delete Staff Member"
              onPress={handleDelete}
              variant="destructive"
              fullWidth
            />
          </View>
        ) : (
          <View style={styles.actionsContainer}>
            <BrandedButton
              title="Edit Details"
              onPress={() => setIsEditMode(true)}
              fullWidth
            />
          </View>
        )}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: BrandColors.neutral.gray900,
    flex: 1,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
  },
  editButtonText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
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
  inputDisabled: {
    backgroundColor: BrandColors.neutral.gray100,
    color: BrandColors.neutral.gray600,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionsContainer: {
    padding: Spacing.lg,
    gap: Spacing.base,
  },
});

