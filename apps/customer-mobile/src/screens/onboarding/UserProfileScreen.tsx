/**
 * User Profile Screen - Customer Mobile App
 * Matches web app CustomerUserProfile component exactly
 * Profile creation with photo upload
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  pincode: string;
  photo?: string;
}

interface UserProfileScreenProps {
  session: any;
  journeyStage?: string;
  onComplete: (profile: UserProfile) => void;
}

export default function UserProfileScreen({
  session,
  journeyStage,
  onComplete,
}: UserProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    email: '',
    phone: session.phone || '',
    address: '',
    pincode: '',
    photo: '',
  });
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handlePhotoUpload = () => {
    const options = {
      mediaType: 'photo' as const,
      quality: 0.8,
      maxWidth: 800,
      maxHeight: 800,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorCode) {
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setPhotoPreview(asset.uri || '');
        setProfile({ ...profile, photo: asset.uri || '' });
      }
    });
  };

  const handleSubmit = async () => {
    // Validation
    if (!profile.firstName || !profile.lastName || !profile.email || !profile.phone || !profile.address || !profile.pincode) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profile.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Pincode validation (6 digits for India)
    if (!/^\d{6}$/.test(profile.pincode)) {
      Alert.alert('Error', 'Please enter a valid 6-digit pincode');
      return;
    }

    setLoading(true);
    try {
      // Save user profile to backend
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            phone: session.phone,
            profile: profile,
            journeyType: journeyStage,
          }),
        }
      );

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(`Failed to save profile: ${responseData.error || response.statusText}`);
      }

      console.log('User profile saved successfully');
      onComplete(profile);
    } catch (error) {
      console.error('Error saving user profile:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.pawLogo}>
            <View style={styles.pawPad} />
            <View style={styles.heart} />
            <View style={[styles.toe, styles.toeTopLeft]} />
            <View style={[styles.toe, styles.toeTopCenterLeft]} />
            <View style={[styles.toe, styles.toeTopCenterRight]} />
            <View style={[styles.toe, styles.toeTopRight]} />
          </View>
        </View>

        {/* Orange Circle Icon */}
        <View style={styles.iconSection}>
          <View style={styles.iconCircle}>
            <Icon name="person" size={48} color="#FFFFFF" />
          </View>
          <Text style={[Typography.h2, styles.iconTitle]}>
            Create Your{'\n'}Profile 👤
          </Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={[Typography.bodySmall, styles.contentSubtitle]}>
            Let's set up your account 🌟{'\n'}
            Almost there!
          </Text>

          {/* Photo Upload */}
          <View style={styles.photoSection}>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={handlePhotoUpload}
            >
              {photoPreview ? (
                <Image source={{ uri: photoPreview }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Icon name="camera-alt" size={32} color={BrandColors.primary.orange} />
                  <Text style={[Typography.bodySmall, styles.photoText]}>
                    Add Photo
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            {/* First Name */}
            <View style={styles.fieldContainer}>
              <Text style={[Typography.bodySmall, styles.label]}>
                First Name *
              </Text>
              <TextInput
                style={styles.input}
                value={profile.firstName}
                onChangeText={(text) => setProfile({ ...profile, firstName: text })}
                placeholder="Enter your first name"
                placeholderTextColor={BrandColors.neutral.gray400}
                autoCapitalize="words"
              />
            </View>

            {/* Last Name */}
            <View style={styles.fieldContainer}>
              <Text style={[Typography.bodySmall, styles.label]}>
                Last Name *
              </Text>
              <TextInput
                style={styles.input}
                value={profile.lastName}
                onChangeText={(text) => setProfile({ ...profile, lastName: text })}
                placeholder="Enter your last name"
                placeholderTextColor={BrandColors.neutral.gray400}
                autoCapitalize="words"
              />
            </View>

            {/* Email */}
            <View style={styles.fieldContainer}>
              <Text style={[Typography.bodySmall, styles.label]}>
                Email *
              </Text>
              <TextInput
                style={styles.input}
                value={profile.email}
                onChangeText={(text) => setProfile({ ...profile, email: text })}
                placeholder="your.email@example.com"
                placeholderTextColor={BrandColors.neutral.gray400}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Phone (Read-only) */}
            <View style={styles.fieldContainer}>
              <Text style={[Typography.bodySmall, styles.label]}>
                Phone Number
              </Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={profile.phone}
                editable={false}
                placeholderTextColor={BrandColors.neutral.gray400}
              />
            </View>

            {/* Address */}
            <View style={styles.fieldContainer}>
              <Text style={[Typography.bodySmall, styles.label]}>
                Address *
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={profile.address}
                onChangeText={(text) => setProfile({ ...profile, address: text })}
                placeholder="Enter your full address"
                placeholderTextColor={BrandColors.neutral.gray400}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Pincode */}
            <View style={styles.fieldContainer}>
              <Text style={[Typography.bodySmall, styles.label]}>
                Pincode *
              </Text>
              <TextInput
                style={styles.input}
                value={profile.pincode}
                onChangeText={(text) => setProfile({ ...profile, pincode: text.replace(/[^0-9]/g, '').slice(0, 6) })}
                placeholder="123456"
                placeholderTextColor={BrandColors.neutral.gray400}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
          </View>

          {/* Submit Button */}
          <BrandedButton
            title={loading ? 'Saving...' : 'Continue'}
            onPress={handleSubmit}
            disabled={loading}
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.xl,
  },
  logoContainer: {
    width: 64,
    height: 64,
    alignSelf: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pawLogo: {
    width: 60,
    height: 60,
    position: 'relative',
  },
  pawPad: {
    position: 'absolute',
    width: 33,
    height: 39,
    borderRadius: 16.5,
    backgroundColor: BrandColors.neutral.black,
    bottom: 0,
    left: '50%',
    marginLeft: -16.5,
  },
  heart: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: BrandColors.primary.orange,
    borderRadius: 6,
    bottom: 15,
    left: '50%',
    marginLeft: -6,
    transform: [{ rotate: '45deg' }],
  },
  toe: {
    position: 'absolute',
    width: 15,
    height: 21,
    borderRadius: 7.5,
    backgroundColor: BrandColors.neutral.black,
  },
  toeTopLeft: {
    top: 7.5,
    left: 7.5,
    transform: [{ rotate: '-15deg' }],
  },
  toeTopCenterLeft: {
    top: 0,
    left: 15,
    transform: [{ rotate: '-5deg' }],
  },
  toeTopCenterRight: {
    top: 0,
    right: 15,
    transform: [{ rotate: '5deg' }],
  },
  toeTopRight: {
    top: 7.5,
    right: 7.5,
    transform: [{ rotate: '15deg' }],
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: BrandColors.primary.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  iconTitle: {
    color: BrandColors.neutral.black,
    textAlign: 'center',
  },
  content: {
    width: '100%',
  },
  contentSubtitle: {
    color: BrandColors.neutral.gray700,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  photoButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: BrandColors.primary.orange,
    borderStyle: 'dashed',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: BrandColors.neutral.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: {
    marginTop: Spacing.xs,
    color: BrandColors.primary.orange,
  },
  form: {
    width: '100%',
    gap: Spacing.base,
    marginBottom: Spacing.xl,
  },
  fieldContainer: {
    marginBottom: Spacing.base,
  },
  label: {
    color: BrandColors.neutral.gray700,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray300,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.base,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    backgroundColor: '#FFFFFF',
  },
  inputDisabled: {
    backgroundColor: BrandColors.neutral.gray100,
    color: BrandColors.neutral.gray600,
  },
  textArea: {
    height: 80,
    paddingTop: Spacing.base,
  },
});

