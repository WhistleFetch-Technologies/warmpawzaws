/**
 * Solo Provider Onboarding Screen - Vendor Mobile App
 * Matches web app SoloProviderOnboarding component
 * Simplified registration for solo practitioners
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface SoloProviderOnboardingScreenProps {
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

interface TimeSlot {
  open: string;
  close: string;
  enabled: boolean;
}

export default function SoloProviderOnboardingScreen({
  route,
  navigation,
  onSubmit,
  onBack,
  submitting,
}: SoloProviderOnboardingScreenProps) {
  const roleId = route?.params?.roleId || 'service-provider';
  const roleName = route?.params?.roleName || 'Service Provider';
  const initialPhone = route?.params?.phone || '';

  // Basic Info
  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState('');

  // Documents
  const [panNumber, setPanNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');

  // Service Area
  const [serviceAreaType, setServiceAreaType] = useState<'RADIUS' | 'SPECIFIC_AREAS'>('RADIUS');
  const [radiusKm, setRadiusKm] = useState('10');
  const [specificAreas, setSpecificAreas] = useState<string[]>([]);
  const [newArea, setNewArea] = useState('');

  // Professional Info
  const [experience, setExperience] = useState('');
  const [bio, setBio] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [newSpecialization, setNewSpecialization] = useState('');

  // Operating Hours
  const [operatingHours, setOperatingHours] = useState<Record<string, TimeSlot>>({
    monday: { open: '09:00', close: '18:00', enabled: true },
    tuesday: { open: '09:00', close: '18:00', enabled: true },
    wednesday: { open: '09:00', close: '18:00', enabled: true },
    thursday: { open: '09:00', close: '18:00', enabled: true },
    friday: { open: '09:00', close: '18:00', enabled: true },
    saturday: { open: '09:00', close: '18:00', enabled: true },
    sunday: { open: '09:00', close: '18:00', enabled: false },
  });

  // Profile Photo
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  const handleAddArea = () => {
    if (newArea.trim() && !specificAreas.includes(newArea.trim())) {
      setSpecificAreas([...specificAreas, newArea.trim()]);
      setNewArea('');
    }
  };

  const handleRemoveArea = (area: string) => {
    setSpecificAreas(specificAreas.filter(a => a !== area));
  };

  const handleAddSpecialization = () => {
    if (newSpecialization.trim() && !specializations.includes(newSpecialization.trim())) {
      setSpecializations([...specializations, newSpecialization.trim()]);
      setNewSpecialization('');
    }
  };

  const handleRemoveSpecialization = (spec: string) => {
    setSpecializations(specializations.filter(s => s !== spec));
  };

  const handlePickPhoto = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
      },
      (response) => {
        if (response.assets && response.assets[0]) {
          setProfilePhoto(response.assets[0].uri || null);
        }
      }
    );
  };

  const handleSubmit = () => {
    // Validation
    if (!ownerName || !phone || !panNumber || !accountNumber || !ifscCode) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    const serviceArea = {
      type: serviceAreaType,
      displayText: serviceAreaType === 'RADIUS' 
        ? `Within ${radiusKm} km radius`
        : `Serves ${specificAreas.join(', ')}`,
      center: { lat: 0, lng: 0 }, // Will be updated with actual location
      radiusKm: serviceAreaType === 'RADIUS' ? parseInt(radiusKm) : undefined,
      areas: serviceAreaType === 'SPECIFIC_AREAS' ? specificAreas : undefined,
    };

    const bankAccount = {
      accountNumber,
      ifscCode,
      accountHolderName: accountHolderName || ownerName,
      bankName,
    };

    onSubmit({
      ownerName,
      businessName: businessName || `${ownerName} - ${roleName}`,
      phone,
      email,
      panNumber,
      bankAccount,
      serviceArea,
      operatingHours,
      experience: parseInt(experience) || 0,
      specializations,
      bio,
      profilePhoto,
    });
  };

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
            <Text style={[Typography.body, styles.backButtonText]}>Back</Text>
          </TouchableOpacity>
          
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Solo Provider</Text>
            </View>
            <View style={[styles.badge, styles.roleBadge]}>
              <Text style={styles.badgeText}>{roleName}</Text>
            </View>
          </View>

          <Text style={[Typography.h1, styles.title]}>Quick Onboarding</Text>
          <Text style={[Typography.bodySmall, styles.subtitle]}>
            Simplified registration for solo practitioners. No GST or shop license required!
          </Text>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="person" size={24} color={BrandColors.primary.orange} />
            <Text style={[Typography.h3, styles.sectionTitle]}>Basic Information</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              Full Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={ownerName}
              onChangeText={setOwnerName}
              placeholder="Your full name"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Business Name (Optional)</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder={`e.g., ${ownerName || 'Your'} ${roleName}`}
              placeholderTextColor={BrandColors.neutral.gray400}
            />
            <Text style={[Typography.bodyTiny, styles.helpText]}>
              Leave blank to use: "{ownerName || 'Your Name'} - {roleName}"
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              Phone Number <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, initialPhone && styles.inputDisabled]}
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 XXXXX XXXXX"
              keyboardType="phone-pad"
              editable={!initialPhone}
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>
        </View>

        {/* Documents */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="description" size={24} color={BrandColors.primary.orange} />
            <Text style={[Typography.h3, styles.sectionTitle]}>Documents (Simplified)</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              PAN Number <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={panNumber}
              onChangeText={(text) => setPanNumber(text.toUpperCase().slice(0, 10))}
              placeholder="ABCDE1234F"
              maxLength={10}
              autoCapitalize="characters"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
            <Text style={[Typography.bodyTiny, styles.helpText]}>Required for payouts</Text>
          </View>

          <View style={styles.infoBox}>
            <Icon name="info" size={20} color={BrandColors.semantic.info} />
            <View style={styles.infoContent}>
              <Text style={[Typography.bodySmall, styles.infoText]}>
                ✅ <Text style={styles.infoBold}>No GST required</Text> - Only needed if annual turnover exceeds ₹20 lakhs
              </Text>
              <Text style={[Typography.bodySmall, styles.infoText]}>
                ✅ <Text style={styles.infoBold}>No shop license required</Text> - You work from customer locations
              </Text>
            </View>
          </View>
        </View>

        {/* Bank Account */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="account-balance" size={24} color={BrandColors.primary.orange} />
            <Text style={[Typography.h3, styles.sectionTitle]}>Bank Account Details <Text style={styles.required}>*</Text></Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Account Holder Name</Text>
            <TextInput
              style={styles.input}
              value={accountHolderName}
              onChangeText={setAccountHolderName}
              placeholder={ownerName || "Your name as per bank"}
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              Account Number <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="XXXX XXXX XXXX"
              keyboardType="numeric"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>
              IFSC Code <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={ifscCode}
              onChangeText={(text) => setIfscCode(text.toUpperCase().slice(0, 11))}
              placeholder="ABCD0123456"
              maxLength={11}
              autoCapitalize="characters"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Bank Name</Text>
            <TextInput
              style={styles.input}
              value={bankName}
              onChangeText={setBankName}
              placeholder="e.g., HDFC Bank"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>
        </View>

        {/* Service Area */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="place" size={24} color={BrandColors.primary.orange} />
            <Text style={[Typography.h3, styles.sectionTitle]}>Service Area</Text>
          </View>
          <Text style={[Typography.bodySmall, styles.sectionDescription]}>
            Define where you provide services. Your home address will NOT be shown to customers.
          </Text>

          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                serviceAreaType === 'RADIUS' && styles.toggleButtonActive,
              ]}
              onPress={() => setServiceAreaType('RADIUS')}
            >
              <Text
                style={[
                  Typography.body,
                  serviceAreaType === 'RADIUS' && styles.toggleButtonTextActive,
                ]}
              >
                Radius Based
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                serviceAreaType === 'SPECIFIC_AREAS' && styles.toggleButtonActive,
              ]}
              onPress={() => setServiceAreaType('SPECIFIC_AREAS')}
            >
              <Text
                style={[
                  Typography.body,
                  serviceAreaType === 'SPECIFIC_AREAS' && styles.toggleButtonTextActive,
                ]}
              >
                Specific Areas
              </Text>
            </TouchableOpacity>
          </View>

          {serviceAreaType === 'RADIUS' ? (
            <View style={styles.formGroup}>
              <Text style={[Typography.bodySmall, styles.label]}>Service Radius (km)</Text>
              <TextInput
                style={styles.input}
                value={radiusKm}
                onChangeText={setRadiusKm}
                placeholder="10"
                keyboardType="numeric"
                placeholderTextColor={BrandColors.neutral.gray400}
              />
              <Text style={[Typography.bodyTiny, styles.helpText]}>
                You'll serve customers within {radiusKm} km from your location
              </Text>
            </View>
          ) : (
            <View style={styles.formGroup}>
              <Text style={[Typography.bodySmall, styles.label]}>Areas You Serve</Text>
              <View style={styles.tagsContainer}>
                {specificAreas.map((area, idx) => (
                  <View key={idx} style={styles.tag}>
                    <Text style={[Typography.bodyTiny, styles.tagText]}>{area}</Text>
                    <TouchableOpacity onPress={() => handleRemoveArea(area)}>
                      <Icon name="close" size={16} color={BrandColors.neutral.gray600} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={styles.addInputContainer}>
                <TextInput
                  style={[styles.input, styles.addInput]}
                  value={newArea}
                  onChangeText={setNewArea}
                  placeholder="Enter area name (e.g., Koramangala)"
                  placeholderTextColor={BrandColors.neutral.gray400}
                  onSubmitEditing={handleAddArea}
                />
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddArea}
                >
                  <Icon name="add" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Professional Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="school" size={24} color={BrandColors.primary.orange} />
            <Text style={[Typography.h3, styles.sectionTitle]}>Professional Information</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Years of Experience</Text>
            <TextInput
              style={styles.input}
              value={experience}
              onChangeText={setExperience}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Bio / About You</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell customers about yourself, your experience, and what makes you special..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={BrandColors.neutral.gray400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[Typography.bodySmall, styles.label]}>Specializations</Text>
            <View style={styles.tagsContainer}>
              {specializations.map((spec, idx) => (
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
                value={newSpecialization}
                onChangeText={setNewSpecialization}
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

        {/* Operating Hours */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="schedule" size={24} color={BrandColors.primary.orange} />
            <Text style={[Typography.h3, styles.sectionTitle]}>Operating Hours</Text>
          </View>

          {DAYS.map((day) => {
            const dayKey = day.toLowerCase();
            const hours = operatingHours[dayKey];

            return (
              <View key={day} style={styles.hoursRow}>
                <View style={styles.hoursDayContainer}>
                  <Text style={[Typography.body, styles.hoursDay]}>{day}</Text>
                </View>
                <View style={styles.hoursTimeContainer}>
                  <TextInput
                    style={[styles.timeInput, !hours.enabled && styles.timeInputDisabled]}
                    value={hours.open}
                    onChangeText={(text) =>
                      setOperatingHours({
                        ...operatingHours,
                        [dayKey]: { ...hours, open: text },
                      })
                    }
                    placeholder="09:00"
                    editable={hours.enabled}
                    placeholderTextColor={BrandColors.neutral.gray400}
                  />
                  <Text style={styles.hoursSeparator}>-</Text>
                  <TextInput
                    style={[styles.timeInput, !hours.enabled && styles.timeInputDisabled]}
                    value={hours.close}
                    onChangeText={(text) =>
                      setOperatingHours({
                        ...operatingHours,
                        [dayKey]: { ...hours, close: text },
                      })
                    }
                    placeholder="18:00"
                    editable={hours.enabled}
                    placeholderTextColor={BrandColors.neutral.gray400}
                  />
                </View>
                <TouchableOpacity
                  style={styles.toggleSwitch}
                  onPress={() =>
                    setOperatingHours({
                      ...operatingHours,
                      [dayKey]: { ...hours, enabled: !hours.enabled },
                    })
                  }
                >
                  <View
                    style={[
                      styles.toggleSwitchTrack,
                      hours.enabled && styles.toggleSwitchTrackActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleSwitchThumb,
                        hours.enabled && styles.toggleSwitchThumbActive,
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Profile Photo */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="camera-alt" size={24} color={BrandColors.primary.orange} />
            <Text style={[Typography.h3, styles.sectionTitle]}>Profile Photo</Text>
          </View>
          <TouchableOpacity style={styles.photoButton} onPress={handlePickPhoto}>
            {profilePhoto ? (
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.xl,
  },
  header: {
    marginBottom: Spacing.xl,
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
  badgeContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  badge: {
    backgroundColor: BrandColors.primary.orange,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  roleBadge: {
    backgroundColor: BrandColors.neutral.gray200,
  },
  badgeText: {
    ...Typography.bodyTiny,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  title: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: BrandColors.neutral.gray600,
  },
  section: {
    marginBottom: Spacing.xl,
    backgroundColor: BrandColors.neutral.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
  },
  sectionDescription: {
    color: BrandColors.neutral.gray600,
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
  inputDisabled: {
    backgroundColor: BrandColors.neutral.gray100,
    color: BrandColors.neutral.gray500,
  },
  textArea: {
    minHeight: 100,
    paddingTop: Spacing.base,
  },
  helpText: {
    color: BrandColors.neutral.gray500,
    marginTop: Spacing.xs,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: BrandColors.semantic.info + '20',
    borderWidth: 1,
    borderColor: BrandColors.semantic.info + '40',
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    gap: Spacing.sm,
    marginTop: Spacing.base,
  },
  infoContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  infoText: {
    color: BrandColors.semantic.info,
  },
  infoBold: {
    fontWeight: '600',
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  toggleButton: {
    flex: 1,
    padding: Spacing.base,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray300,
    alignItems: 'center',
    backgroundColor: BrandColors.neutral.white,
  },
  toggleButtonActive: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '20',
  },
  toggleButtonTextActive: {
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
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.base,
    gap: Spacing.base,
  },
  hoursDayContainer: {
    width: 100,
  },
  hoursDay: {
    color: BrandColors.neutral.gray700,
    fontWeight: '600',
  },
  hoursTimeContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray300,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    textAlign: 'center',
  },
  timeInputDisabled: {
    backgroundColor: BrandColors.neutral.gray100,
    color: BrandColors.neutral.gray500,
  },
  hoursSeparator: {
    ...Typography.body,
    color: BrandColors.neutral.gray600,
  },
  toggleSwitch: {
    width: 50,
  },
  toggleSwitchTrack: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: BrandColors.neutral.gray300,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchTrackActive: {
    backgroundColor: BrandColors.primary.orange,
  },
  toggleSwitchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleSwitchThumbActive: {
    transform: [{ translateX: 22 }],
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
});

