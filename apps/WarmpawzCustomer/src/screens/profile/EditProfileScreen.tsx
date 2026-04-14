/**
 * Edit Profile Screen - Mobile
 * Edit user profile details (aligned with web + PUT /customer/profile schema)
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
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';
import { AddressAutocomplete, type AddressComponents } from '../../components/AddressAutocomplete';

interface EditProfileScreenProps {
  phone: string;
  customerId?: string;
  profile?: any;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: () => void;
}

function mapApiProfileToForm(profileData: Record<string, any>, fallbackPhone: string) {
  const displayName = profileData.name ?? profileData.full_name ?? '';
  const parts = String(displayName).trim().split(/\s+/).filter(Boolean);
  const firstName = String(profileData.firstName || parts[0] || '').trim();
  const lastName = String(profileData.lastName || parts.slice(1).join(' ') || '').trim();

  let address = '';
  if (typeof profileData.address === 'string') {
    address = profileData.address;
  } else if (profileData.address != null && typeof profileData.address === 'object') {
    address =
      profileData.address.street ||
      profileData.address.addressLine1 ||
      profileData.address.line1 ||
      '';
  }

  return {
    firstName,
    lastName,
    email: String(profileData.email || '').trim(),
    phone: String(profileData.phone || fallbackPhone),
    address: String(address).trim(),
    pincode: String(profileData.pincode || '').replace(/\D/g, '').slice(0, 6),
    city: String(profileData.city || '').trim(),
    state: String(profileData.state || '').trim(),
    houseNo: String(profileData.houseNo ?? profileData.house_no ?? '').trim(),
    floor: String(profileData.floor ?? '').trim(),
    dateOfBirth: String(profileData.dateOfBirth || profileData.date_of_birth || '').trim(),
    gender: String(profileData.gender || '').trim(),
  };
}

export function EditProfileScreen({
  phone,
  customerId,
  profile: initialProfile,
  onBack,
  onSuccess,
}: EditProfileScreenProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(phone);
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [floor, setFloor] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!initialProfile);

  useEffect(() => {
    if (initialProfile) {
      const m = mapApiProfileToForm(initialProfile, phone);
      setFirstName(m.firstName);
      setLastName(m.lastName);
      setEmail(m.email);
      setPhoneNumber(m.phone);
      setAddress(m.address);
      setPincode(m.pincode);
      setCity(m.city);
      setState(m.state);
      setHouseNo(m.houseNo);
      setFloor(m.floor);
      setDateOfBirth(m.dateOfBirth);
      setGender(m.gender);
      setLoading(false);
      return;
    }
    if (customerId || phone) {
      loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once from route or fetch
  }, []);

  const loadProfile = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await CustomerApi.getProfile(customerId || phone);
      const profileData = response.profile || response;
      const m = mapApiProfileToForm(profileData, phone);
      setFirstName(m.firstName);
      setLastName(m.lastName);
      setEmail(m.email);
      setPhoneNumber(m.phone);
      setAddress(m.address);
      setPincode(m.pincode);
      setCity(m.city);
      setState(m.state);
      setHouseNo(m.houseNo);
      setFloor(m.floor);
      setDateOfBirth(m.dateOfBirth);
      setGender(m.gender);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const applyAddressFromAutocomplete = (addr: string, components?: AddressComponents) => {
    setAddress(addr);
    if (components?.pincode) {
      setPincode(components.pincode.replace(/\D/g, '').slice(0, 6));
    }
    if (components?.city) {
      setCity(components.city);
    }
    if (components?.state) {
      setState(components.state);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'First and last name are required');
      return;
    }

    if (email && !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    const addr = address.trim();
    if (addr && !houseNo.trim()) {
      Alert.alert('Error', 'Please enter House / Flat number when address is set');
      return;
    }

    if (addr && pincode.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit pincode');
      return;
    }

    try {
      setSaving(true);
      const payload: Record<string, string | undefined> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        address: addr || undefined,
        pincode: pincode ? pincode : undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        floor: floor.trim() || undefined,
      };

      if (addr) {
        payload.houseNo = houseNo.trim();
      }

      await CustomerApi.updateProfile(customerId || phone, payload);

      await loadProfile(true);

      Alert.alert('Success', 'Profile updated successfully', [
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
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.photoContainer}>
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>
              {(firstName.charAt(0) || 'U').toUpperCase()}
              {(lastName.charAt(0) || '').toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.changePhotoButton}
            onPress={() => {
              Alert.alert('Change Photo', 'Photo upload feature coming soon');
            }}
          >
            <Text style={styles.changePhotoButtonText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name *</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={phoneNumber}
              editable={false}
              placeholder="Phone number"
            />
            <Text style={styles.helperText}>Phone number cannot be changed</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <AddressAutocomplete
              value={address}
              onChange={applyAddressFromAutocomplete}
              placeholder="Search address, landmark, city..."
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.rowItem]}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="City"
              />
            </View>
            <View style={[styles.inputGroup, styles.rowItem]}>
              <Text style={styles.label}>State</Text>
              <TextInput
                style={styles.input}
                value={state}
                onChangeText={setState}
                placeholder="State"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pincode</Text>
            <TextInput
              style={styles.input}
              value={pincode}
              onChangeText={(t) => setPincode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit pincode"
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>House No / Flat No *</Text>
            <TextInput
              style={styles.input}
              value={houseNo}
              onChangeText={setHouseNo}
              placeholder="e.g., A-101"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Floor</Text>
            <TextInput
              style={styles.input}
              value={floor}
              onChangeText={setFloor}
              placeholder="e.g., 1st Floor"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Birth</Text>
            <TouchableOpacity style={styles.input}>
              <Text style={[styles.inputText, !dateOfBirth && styles.placeholderText]}>
                {dateOfBirth || 'Select date of birth'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderContainer}>
              {(['male', 'female', 'other'] as const).map((genderOption) => (
                <TouchableOpacity
                  key={genderOption}
                  style={[
                    styles.genderButton,
                    gender.toLowerCase() === genderOption && styles.genderButtonSelected,
                  ]}
                  onPress={() => setGender(genderOption)}
                >
                  <Text
                    style={[
                      styles.genderButtonText,
                      gender.toLowerCase() === genderOption && styles.genderButtonTextSelected,
                    ]}
                  >
                    {genderOption.charAt(0).toUpperCase() + genderOption.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (!firstName.trim() || !lastName.trim() || saving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!firstName.trim() || !lastName.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
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
    backgroundColor: colors.white,
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
  photoContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  photoPlaceholderText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
  },
  changePhotoButton: {
    padding: spacing.sm,
  },
  changePhotoButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  form: {
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowItem: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
  },
  disabledInput: {
    backgroundColor: colors.gray['100'],
  },
  inputText: {
    fontSize: 14,
    color: colors.text,
  },
  placeholderText: {
    color: colors.textSecondary,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  genderContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  genderButton: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  genderButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  genderButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  genderButtonTextSelected: {
    color: colors.primary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  saveButtonDisabled: {
    backgroundColor: colors.gray['400'],
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
