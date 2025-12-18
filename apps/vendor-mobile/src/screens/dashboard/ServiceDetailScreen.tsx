/**
 * Service Detail Screen - Vendor Mobile App
 * View and edit service details
 * Create new services
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
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface ServiceDetailScreenProps {
  route?: {
    params?: {
      serviceId?: string;
      service?: any;
      mode?: 'create' | 'edit';
    };
  };
  navigation?: any;
}

export default function ServiceDetailScreen({
  route,
  navigation,
}: ServiceDetailScreenProps) {
  const { vendor } = useAuth();
  const serviceId = route?.params?.serviceId;
  const existingService = route?.params?.service;
  const mode = route?.params?.mode || (serviceId ? 'edit' : 'create');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: existingService?.name || '',
    description: existingService?.description || existingService?.customDescription || '',
    categoryName: existingService?.categoryName || '',
    duration: existingService?.customDuration?.toString() || existingService?.duration?.toString() || '60',
    price: existingService?.customPrice?.toString() || existingService?.price?.toString() || '0',
    isEnabled: existingService?.isEnabled ?? true,
    serviceStyle: existingService?.serviceStyle || 'at_home',
  });

  const handleSave = async () => {
    if (!formData.name || !formData.price || !formData.duration) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;
      const payload = {
        vendorId: vendor?.id,
        name: formData.name,
        description: formData.description,
        categoryName: formData.categoryName,
        customPrice: parseFloat(formData.price),
        customDuration: parseInt(formData.duration),
        customDescription: formData.description,
        serviceStyle: formData.serviceStyle,
        isEnabled: formData.isEnabled,
      };

      let response;
      if (mode === 'create') {
        response = await fetch(`${API_BASE}/vendor/services/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch(`${API_BASE}/vendor/services/${serviceId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        Alert.alert('Success', `Service ${mode === 'create' ? 'created' : 'updated'} successfully`);
        if (navigation) {
          navigation.goBack();
        }
      } else {
        throw new Error('Failed to save service');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save service. Please try again.');
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
            {mode === 'create' ? 'Add Service' : 'Edit Service'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              Service Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="e.g., Pet Grooming"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              Category
            </Text>
            <TextInput
              style={styles.input}
              value={formData.categoryName}
              onChangeText={(text) => setFormData({ ...formData, categoryName: text })}
              placeholder="e.g., Grooming"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              Description
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Describe your service..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, styles.formGroupHalf]}>
              <Text style={[Typography.bodySmall, styles.label]}>
                Duration (minutes) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={formData.duration}
                onChangeText={(text) => setFormData({ ...formData, duration: text.replace(/[^0-9]/g, '') })}
                placeholder="60"
                keyboardType="numeric"
                placeholderTextColor={BrandColors.neutral.gray400}
              />
            </View>

            <View style={[styles.formGroup, styles.formGroupHalf]}>
              <Text style={[Typography.bodySmall, styles.label]}>
                Price (₹) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={formData.price}
                onChangeText={(text) => setFormData({ ...formData, price: text.replace(/[^0-9.]/g, '') })}
                placeholder="0"
                keyboardType="numeric"
                placeholderTextColor={BrandColors.neutral.gray400}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              Service Style
            </Text>
            <View style={styles.styleButtons}>
              {(['at_home', 'at_center', 'tele'] as const).map((style) => (
                <TouchableOpacity
                  key={style}
                  style={[
                    styles.styleButton,
                    formData.serviceStyle === style && styles.styleButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, serviceStyle: style })}
                >
                  <Text
                    style={[
                      Typography.bodySmall,
                      formData.serviceStyle === style && styles.styleButtonTextActive,
                    ]}
                  >
                    {style === 'at_home' ? 'At Home' :
                     style === 'at_center' ? 'At Center' : 'Tele'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <View style={styles.switchRow}>
              <Text style={[Typography.body, styles.label]}>
                Enable Service
              </Text>
              <Switch
                value={formData.isEnabled}
                onValueChange={(value) => setFormData({ ...formData, isEnabled: value })}
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
        <View style={styles.actionsContainer}>
          <BrandedButton
            title={saving ? 'Saving...' : 'Save Service'}
            onPress={handleSave}
            disabled={saving}
            loading={saving}
            fullWidth
          />
          {mode === 'edit' && (
            <BrandedButton
              title="Delete Service"
              onPress={() => {
                Alert.alert(
                  'Delete Service',
                  'Are you sure you want to delete this service?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        // TODO: Implement delete
                        Alert.alert('Info', 'Delete functionality to be implemented');
                      },
                    },
                  ]
                );
              }}
              variant="destructive"
              fullWidth
            />
          )}
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
  textArea: {
    minHeight: 100,
    paddingTop: Spacing.base,
  },
  styleButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  styleButton: {
    flex: 1,
    padding: Spacing.base,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray300,
    alignItems: 'center',
    backgroundColor: BrandColors.neutral.white,
  },
  styleButtonActive: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '20',
  },
  styleButtonTextActive: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
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
