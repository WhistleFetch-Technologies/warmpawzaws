/**
 * Customer User Profile Screen
 * User profile creation/editing form
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
import { API_BASE_URL } from '../../config/aws';
import { AddressAutocomplete, type AddressComponents } from '../../components/AddressAutocomplete';

interface CustomerUserProfileScreenProps {
  phone: string;
  journeyStage?: string;
  onComplete: (profile: UserProfile) => void;
  onBack?: () => void;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  pincode: string;
  photo?: string;
}

export function CustomerUserProfileScreen({
  phone,
  journeyStage,
  onComplete,
  onBack,
}: CustomerUserProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    email: '',
    phone: phone || '',
    address: '',
    pincode: '',
    photo: '',
  });
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Cleanup
  useEffect(() => {
    return () => {
      setProfile({
        firstName: '',
        lastName: '',
        email: '',
        phone: phone || '',
        address: '',
        pincode: '',
        photo: '',
      });
      setPhotoPreview('');
    };
  }, []);

  const handlePhotoUpload = async () => {
    // TODO: Implement image picker when expo-image-picker is installed
    // For now, show a message
    Alert.alert(
      'Photo Upload',
      'Image picker will be available after installing expo-image-picker package.',
      [{ text: 'OK' }]
    );
    // Placeholder implementation
    // try {
    //   const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    //   if (status !== 'granted') {
    //     Alert.alert('Permission Required', 'Please grant camera roll permission to upload photos');
    //     return;
    //   }
    //   const result = await ImagePicker.launchImageLibraryAsync({
    //     mediaTypes: ImagePicker.MediaTypeOptions.Images,
    //     allowsEditing: true,
    //     aspect: [1, 1],
    //     quality: 0.8,
    //   });
    //   if (!result.canceled && result.assets[0]) {
    //     const uri = result.assets[0].uri;
    //     setPhotoPreview(uri);
    //     setProfile({ ...profile, photo: uri });
    //   }
    // } catch (error) {
    //   console.error('Error picking image:', error);
    //   Alert.alert('Error', 'Failed to pick image. Please try again.');
    // }
  };

  const handleTakePhoto = async () => {
    // TODO: Implement camera when expo-image-picker is installed
    Alert.alert(
      'Take Photo',
      'Camera functionality will be available after installing expo-image-picker package.',
      [{ text: 'OK' }]
    );
    // Placeholder implementation
    // try {
    //   const { status } = await ImagePicker.requestCameraPermissionsAsync();
    //   if (status !== 'granted') {
    //     Alert.alert('Permission Required', 'Please grant camera permission to take photos');
    //     return;
    //   }
    //   const result = await ImagePicker.launchCameraAsync({
    //     allowsEditing: true,
    //     aspect: [1, 1],
    //     quality: 0.8,
    //   });
    //   if (!result.canceled && result.assets[0]) {
    //     const uri = result.assets[0].uri;
    //     setPhotoPreview(uri);
    //     setProfile({ ...profile, photo: uri });
    //   }
    // } catch (error) {
    //   console.error('Error taking photo:', error);
    //   Alert.alert('Error', 'Failed to take photo. Please try again.');
    // }
  };

  const showPhotoOptions = () => {
    Alert.alert(
      'Profile Photo',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Gallery', onPress: handlePhotoUpload },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const validateForm = (): boolean => {
    if (!profile.firstName.trim()) {
      Alert.alert('Required', 'Please enter your first name');
      return false;
    }
    if (!profile.lastName.trim()) {
      Alert.alert('Required', 'Please enter your last name');
      return false;
    }
    if (!profile.email.trim()) {
      Alert.alert('Required', 'Please enter your email address');
      return false;
    }
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profile.email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return false;
    }
    if (!profile.phone.trim()) {
      Alert.alert('Required', 'Please enter your phone number');
      return false;
    }
    if (!profile.address.trim()) {
      Alert.alert('Required', 'Please enter your address');
      return false;
    }
    if (!profile.pincode.trim()) {
      Alert.alert('Required', 'Please enter your pincode');
      return false;
    }
    // Pincode validation (6 digits for India)
    if (!/^\d{6}$/.test(profile.pincode)) {
      Alert.alert('Invalid Pincode', 'Please enter a valid 6-digit pincode');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/customer/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: profile.phone,
          profile: profile,
          journeyType: journeyStage,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to save profile');
      }

      console.log('User profile saved successfully');
      onComplete(profile);
    } catch (error: any) {
      console.error('Error saving user profile:', error);
      Alert.alert('Error', error.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>🐾</Text>
        </View>

        {/* Orange Circle Icon */}
        <View style={styles.iconSection}>
          <View style={styles.orangeCircle}>
            <Text style={styles.iconText}>👤</Text>
          </View>
          <Text style={styles.title}>Create Your{'\n'}Profile 👤</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.description}>
            Let's set up your account 🌟{'\n'}Almost there!
          </Text>

          {/* Photo Upload */}
          <View style={styles.photoSection}>
            <TouchableOpacity
              style={styles.photoContainer}
              onPress={showPhotoOptions}
              activeOpacity={0.7}
            >
              {photoPreview ? (
                <Image source={{ uri: photoPreview }} style={styles.photoImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoIcon}>📷</Text>
                  <Text style={styles.photoText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.photoHint}>
              Tap to upload your profile photo{'\n'}(Optional)
            </Text>
          </View>

          {/* First Name and Last Name */}
          <View style={styles.nameRow}>
            <View style={styles.nameInputContainer}>
              <Text style={styles.label}>
                First Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="John"
                placeholderTextColor={colors.textMuted}
                value={profile.firstName}
                onChangeText={(text) => setProfile({ ...profile, firstName: text })}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.nameInputContainer}>
              <Text style={styles.label}>
                Last Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Doe"
                placeholderTextColor={colors.textMuted}
                value={profile.lastName}
                onChangeText={(text) => setProfile({ ...profile, lastName: text })}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>
              Email Address <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="john.doe@example.com"
              placeholderTextColor={colors.textMuted}
              value={profile.email}
              onChangeText={(text) => setProfile({ ...profile, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Phone */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>
              Phone Number <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="+91 9876543210"
              placeholderTextColor={colors.textMuted}
              value={profile.phone}
              onChangeText={(text) => setProfile({ ...profile, phone: text })}
              keyboardType="phone-pad"
              editable={false}
            />
            <Text style={styles.hint}>Phone number from authentication</Text>
          </View>

          {/* Address */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>
              Address <Text style={styles.required}>*</Text>
            </Text>
            <AddressAutocomplete
              value={profile.address}
              onChange={(addr: string, components?: AddressComponents) => {
                setProfile({ ...profile, address: addr });
                // Auto-populate pincode if available
                if (components?.pincode && !profile.pincode) {
                  setProfile({ ...profile, pincode: components.pincode });
                }
              }}
              placeholder="Search address, landmark, city..."
              required
            />
          </View>

          {/* Pincode */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>
              Pincode <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="123456"
              placeholderTextColor={colors.textMuted}
              value={profile.pincode}
              onChangeText={(text) => setProfile({ ...profile, pincode: text })}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Text style={styles.hint}>6-digit pincode</Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>Create Profile</Text>
            )}
          </TouchableOpacity>

          {onBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              disabled={loading}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          )}
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    marginBottom: spacing.md,
  },
  logoEmoji: {
    fontSize: 48,
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  orangeCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconText: {
    fontSize: 48,
  },
  title: {
    fontSize: typography.fontSizes['3xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 36,
  },
  content: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  description: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  photoContainer: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.gradientOrange50,
    borderWidth: 4,
    borderColor: colors.background,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoIcon: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  photoText: {
    fontSize: typography.fontSizes.xs,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  photoHint: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  nameInputContainer: {
    flex: 1,
  },
  inputSection: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.error,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    fontSize: typography.fontSizes.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
  textArea: {
    minHeight: 80,
    paddingTop: spacing.md,
  },
  hint: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs / 2,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
  backButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary,
  },
});

