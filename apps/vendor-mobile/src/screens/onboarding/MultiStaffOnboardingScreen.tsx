/**
 * Multi-Staff Center Onboarding Screen - Vendor Mobile App
 * Matches DynamicVendorOnboardingForm from web app
 * Handles dynamic form based on roleId with document uploads
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
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import Geolocation from '@react-native-community/geolocation';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'tel' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'date' | 'file' | 'map_pin';
  placeholder?: string;
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
  };
  options?: { value: string; label: string }[];
  order: number;
  isActive: boolean;
}

interface FormSection {
  id: string;
  name: string;
  title: string;
  order: number;
  isActive: boolean;
  fields: FormField[];
}

interface OnboardingForm {
  id: string;
  roleId: string;
  sections: FormSection[];
  documentSections: FormSection[];
}

interface MultiStaffOnboardingScreenProps {
  route?: {
    params?: {
      roleId?: string;
      roleName?: string;
      phone?: string;
    };
  };
  navigation?: any;
  onSubmit: (data: any) => void;
  onBack: () => void;
  submitting: boolean;
}

export default function MultiStaffOnboardingScreen({
  route,
  navigation,
  onSubmit,
  onBack,
  submitting,
}: MultiStaffOnboardingScreenProps) {
  const { vendor } = useAuth();
  const roleId = route?.params?.roleId || 'service-provider';
  const roleName = route?.params?.roleName || 'Service Provider';
  const initialPhone = route?.params?.phone || vendor?.phone || '';

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<OnboardingForm | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [documents, setDocuments] = useState<Record<string, string | null>>({});
  const [documentPreviews, setDocumentPreviews] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serviceStyle, setServiceStyle] = useState<'at_home' | 'at_center' | 'both'>('both');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const [mapRegion, setMapRegion] = useState({
    latitude: 20.5937, // India center
    longitude: 78.9629,
    latitudeDelta: 10,
    longitudeDelta: 10,
  });
  const [detectingLocation, setDetectingLocation] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchForm();
  }, [roleId]);

  const fetchForm = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/vendor/onboarding-form/${roleId}?t=${Date.now()}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Cache-Control': 'no-cache',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setForm(data.form);
        
        // Initialize form data with phone
        setFormData({ phone: initialPhone });
      } else {
        Alert.alert('Error', 'Failed to load onboarding form');
      }
    } catch (error) {
      console.error('Error fetching form:', error);
      Alert.alert('Error', 'Cannot connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData({ ...formData, [fieldName]: value });
    if (errors[fieldName]) {
      setErrors({ ...errors, [fieldName]: '' });
    }
  };

  const handleDetectLocation = async () => {
    try {
      setDetectingLocation(true);
      
      const locationPermission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

      const result = await request(locationPermission);
      
      if (result !== RESULTS.GRANTED) {
        Alert.alert(
          'Location Permission Required',
          'Please enable location access to use this feature.',
          [{ text: 'OK' }]
        );
        setDetectingLocation(false);
        return;
      }

      // Use Geolocation API
      Geolocation.getCurrentPosition(
        (position: any) => {
          const { latitude, longitude } = position.coords;
          setCoordinates({ lat: latitude, lng: longitude });
          setMapRegion({
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
          setDetectingLocation(false);
        },
        (error: any) => {
          console.error('Location error:', error);
          Alert.alert(
            'Location Error',
            'Unable to detect your location. Please select manually on the map.',
            [{ text: 'OK' }]
          );
          setDetectingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } catch (error) {
      console.error('Error detecting location:', error);
      setDetectingLocation(false);
    }
  };

  const handleFileUpload = (fieldName: string) => {
    Alert.alert(
      'Upload Document',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Camera',
          onPress: () => {
            launchCamera(
              { mediaType: 'photo', quality: 0.8 },
              (response) => {
                if (response.assets && response.assets[0]) {
                  const uri = response.assets[0].uri;
                  if (uri) {
                    setDocuments({ ...documents, [fieldName]: uri });
                    setDocumentPreviews({ ...documentPreviews, [fieldName]: uri });
                  }
                }
              }
            );
          },
        },
        {
          text: 'Gallery',
          onPress: () => {
            launchImageLibrary(
              { mediaType: 'photo', quality: 0.8 },
              (response) => {
                if (response.assets && response.assets[0]) {
                  const uri = response.assets[0].uri;
                  if (uri) {
                    setDocuments({ ...documents, [fieldName]: uri });
                    setDocumentPreviews({ ...documentPreviews, [fieldName]: uri });
                  }
                }
              }
            );
          },
        },
      ]
    );
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!form) return false;

    // Validate all sections
    form.sections.forEach(section => {
      section.fields.forEach(field => {
        if (!field.isActive) return;

        const value = formData[field.name];
        const isEmpty = !value || value === '' || (Array.isArray(value) && value.length === 0);

        if (field.validation?.required && isEmpty) {
          newErrors[field.name] = `${field.label} is required`;
        }
      });
    });

        // Validate document sections
    if (form.documentSections) {
      form.documentSections.forEach(section => {
        section.fields.forEach(field => {
          if (field.validation?.required && !documents[field.name]) {
            newErrors[field.name] = `${field.label} is required`;
          }
        });
      });
    }

    // Validate map_pin fields (location)
    form.sections.forEach(section => {
      section.fields.forEach(field => {
        if (field.type === 'map_pin' && field.validation?.required && !coordinates) {
          newErrors[field.name] = `${field.label} is required`;
        }
      });
    });

    if (!agreedToTerms) {
      newErrors['terms'] = 'You must accept the terms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    const submissionData = {
      formData,
      documents,
      serviceStyle,
      location: coordinates,
    };

    onSubmit(submissionData);
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
        return (
          <View key={field.id} style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              {field.label} {field.validation?.required && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              value={value}
              onChangeText={(text) => handleFieldChange(field.name, text)}
              placeholder={field.placeholder}
              keyboardType={field.type === 'email' ? 'email-address' : field.type === 'tel' ? 'phone-pad' : 'default'}
              autoCapitalize={field.type === 'email' ? 'none' : 'sentences'}
              placeholderTextColor={BrandColors.neutral.gray400}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case 'textarea':
        return (
          <View key={field.id} style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              {field.label} {field.validation?.required && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea, error && styles.inputError]}
              value={value}
              onChangeText={(text) => handleFieldChange(field.name, text)}
              placeholder={field.placeholder}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case 'number':
        return (
          <View key={field.id} style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              {field.label} {field.validation?.required && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              value={value}
              onChangeText={(text) => handleFieldChange(field.name, text.replace(/[^0-9.]/g, ''))}
              placeholder={field.placeholder}
              keyboardType="numeric"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case 'file':
        return (
          <View key={field.id} style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              {field.label} {field.validation?.required && <Text style={styles.required}>*</Text>}
            </Text>
            <TouchableOpacity
              style={[styles.fileButton, error && styles.inputError]}
              onPress={() => handleFileUpload(field.name)}
            >
              {documentPreviews[field.name] ? (
                <View style={styles.filePreview}>
                  <Icon name="check-circle" size={24} color={BrandColors.semantic.success} />
                  <Text style={[Typography.bodySmall, styles.filePreviewText]}>
                    Document uploaded
                  </Text>
                </View>
              ) : (
                <View style={styles.filePreview}>
                  <Icon name="upload-file" size={24} color={BrandColors.primary.orange} />
                  <Text style={[Typography.bodySmall, styles.fileButtonText]}>
                    Upload {field.label}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case 'map_pin':
        return (
          <View key={field.id} style={styles.formGroup}>
            <View style={styles.mapHeader}>
              <Text style={[Typography.bodySmall, styles.label]}>
                {field.label} {field.validation?.required && <Text style={styles.required}>*</Text>}
              </Text>
              <TouchableOpacity
                style={styles.locationButton}
                onPress={handleDetectLocation}
                disabled={detectingLocation}
              >
                <Icon 
                  name="my-location" 
                  size={20} 
                  color={BrandColors.primary.orange} 
                />
                <Text style={[Typography.bodyTiny, styles.locationButtonText]}>
                  {detectingLocation ? 'Detecting...' : 'Use Current Location'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.mapContainer, error && styles.inputError]}>
              <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                region={mapRegion}
                onRegionChangeComplete={setMapRegion}
                onPress={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setCoordinates({ lat: latitude, lng: longitude });
                  setMapRegion({
                    latitude,
                    longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  });
                }}
              >
                {coordinates && (
                  <Marker
                    coordinate={{
                      latitude: coordinates.lat,
                      longitude: coordinates.lng,
                    }}
                    draggable
                    onDragEnd={(e) => {
                      const { latitude, longitude } = e.nativeEvent.coordinate;
                      setCoordinates({ lat: latitude, lng: longitude });
                    }}
                  />
                )}
              </MapView>
            </View>
            {coordinates && (
              <Text style={[Typography.bodyTiny, styles.coordinatesText]}>
                📍 {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
              </Text>
            )}
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading form...
        </Text>
      </View>
    );
  }

  if (!form) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.emptyContainer}>
          <Icon name="error-outline" size={48} color={BrandColors.neutral.gray400} />
          <Text style={[Typography.body, styles.emptyText]}>
            Failed to load onboarding form
          </Text>
          <BrandedButton
            title="Retry"
            onPress={fetchForm}
            fullWidth
            style={styles.retryButton}
          />
        </View>
      </View>
    );
  }

  const allSections = [
    ...(form.sections || []),
    ...(form.documentSections || []),
  ].sort((a, b) => a.order - b.order);

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
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
            <Text style={[Typography.body, styles.backButtonText]}>Back</Text>
          </TouchableOpacity>
          
          <Text style={[Typography.h1, styles.title]}>Business Onboarding</Text>
          <Text style={[Typography.bodySmall, styles.subtitle]}>
            Complete your business details to get started
          </Text>
        </View>

        {/* Service Style Selection */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Service Style</Text>
          <View style={styles.styleButtons}>
            {(['at_home', 'at_center', 'both'] as const).map((style) => (
              <TouchableOpacity
                key={style}
                style={[
                  styles.styleButton,
                  serviceStyle === style && styles.styleButtonActive,
                ]}
                onPress={() => setServiceStyle(style)}
              >
                <Text
                  style={[
                    Typography.body,
                    serviceStyle === style && styles.styleButtonTextActive,
                  ]}
                >
                  {style === 'at_home' ? 'At Home' :
                   style === 'at_center' ? 'At Center' : 'Both'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Form Sections */}
        {allSections.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>
              {section.title}
            </Text>
            {section.fields
              .filter(f => f.isActive)
              .sort((a, b) => a.order - b.order)
              .map(renderField)}
          </View>
        ))}

        {/* Terms Agreement */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
          >
            <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
              {agreedToTerms && (
                <Icon name="check" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text style={[Typography.bodySmall, styles.checkboxLabel]}>
              I agree to the terms and conditions
            </Text>
          </TouchableOpacity>
          {errors['terms'] && (
            <Text style={styles.errorText}>{errors['terms']}</Text>
          )}
        </View>

        {/* Submit Button */}
        <BrandedButton
          title={submitting ? 'Submitting...' : 'Submit Application'}
          onPress={handleSubmit}
          disabled={submitting}
          loading={submitting}
          fullWidth
        />
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.base,
    gap: Spacing.xs,
  },
  backButtonText: {
    color: BrandColors.primary.orange,
  },
  title: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: BrandColors.neutral.gray600,
  },
  section: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
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
  inputError: {
    borderColor: BrandColors.semantic.error,
  },
  textArea: {
    minHeight: 100,
    paddingTop: Spacing.base,
  },
  errorText: {
    ...Typography.bodyTiny,
    color: BrandColors.semantic.error,
    marginTop: Spacing.xs,
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
  fileButton: {
    borderWidth: 2,
    borderColor: BrandColors.primary.orange,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.primary.orange + '10',
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  fileButtonText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  filePreviewText: {
    color: BrandColors.semantic.success,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.xs,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: BrandColors.primary.orange,
    borderColor: BrandColors.primary.orange,
  },
  checkboxLabel: {
    color: BrandColors.neutral.gray700,
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.base,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  retryButton: {
    maxWidth: 200,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.xs,
    backgroundColor: BrandColors.primary.orange + '10',
    borderRadius: BorderRadius.sm,
  },
  locationButtonText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  mapContainer: {
    height: 250,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray300,
    marginTop: Spacing.sm,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  coordinatesText: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.xs,
    fontFamily: 'monospace',
  },
});

