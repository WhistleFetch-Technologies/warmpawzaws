/**
 * Adoption Application Screen - Customer Mobile App
 * Apply for pet adoption with form
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { API_BASE_URL, getPublicAnonKey } from '../../config/api';
import ErrorHandler from '../../utils/errorHandler';

export default function AdoptionApplicationScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { publicationId } = route.params as { publicationId: string };

  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    applicantName: user?.name || '',
    applicantPhone: user?.phone || '',
    applicantEmail: user?.email || '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    experienceWithPets: '',
    currentPets: '',
    livingSituation: '',
    reasonForAdoption: '',
    references: '',
  });

  useEffect(() => {
    loadListingDetails();
  }, [publicationId]);

  const loadListingDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/adoption-listing/${publicationId}`, {
        headers: {
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setListing(data.listing);
      } else {
        const error = await response.json();
        ErrorHandler.showError(error);
      }
    } catch (error) {
      ErrorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validate form
    if (!formData.applicantName || !formData.applicantPhone || !formData.address) {
      Alert.alert('Incomplete Form', 'Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const applicationData = {
        publicationId,
        customerId: user?.id,
        customerPhone: user?.phone,
        ...formData,
      };

      const response = await fetch(`${API_BASE_URL}/adoption/${publicationId}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
        body: JSON.stringify(applicationData),
      });

      if (response.ok) {
        Alert.alert(
          'Application Submitted',
          'Your adoption application has been submitted successfully. The shelter will contact you soon.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        const error = await response.json();
        ErrorHandler.showError(error);
      }
    } catch (error) {
      ErrorHandler.showError(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {listing && (
        <View style={styles.listingInfo}>
          <Text style={styles.listingTitle}>Adopting: {listing.petName}</Text>
          <Text style={styles.listingSubtitle}>
            {listing.petType} {listing.breed && `- ${listing.breed}`}
          </Text>
        </View>
      )}

      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Personal Information</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.applicantName}
            onChangeText={(text) => setFormData({ ...formData, applicantName: text })}
            placeholder="Enter your full name"
            placeholderTextColor={BrandColors.text.secondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={styles.input}
            value={formData.applicantPhone}
            onChangeText={(text) => setFormData({ ...formData, applicantPhone: text })}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
            placeholderTextColor={BrandColors.text.secondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={formData.applicantEmail}
            onChangeText={(text) => setFormData({ ...formData, applicantEmail: text })}
            placeholder="Enter your email"
            keyboardType="email-address"
            placeholderTextColor={BrandColors.text.secondary}
          />
        </View>

        <Text style={styles.sectionTitle}>Address</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Street Address *</Text>
          <TextInput
            style={styles.input}
            value={formData.address}
            onChangeText={(text) => setFormData({ ...formData, address: text })}
            placeholder="Enter your address"
            placeholderTextColor={BrandColors.text.secondary}
            multiline
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>City *</Text>
            <TextInput
              style={styles.input}
              value={formData.city}
              onChangeText={(text) => setFormData({ ...formData, city: text })}
              placeholder="City"
              placeholderTextColor={BrandColors.text.secondary}
            />
          </View>

          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>State *</Text>
            <TextInput
              style={styles.input}
              value={formData.state}
              onChangeText={(text) => setFormData({ ...formData, state: text })}
              placeholder="State"
              placeholderTextColor={BrandColors.text.secondary}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Pincode *</Text>
          <TextInput
            style={styles.input}
            value={formData.pincode}
            onChangeText={(text) => setFormData({ ...formData, pincode: text })}
            placeholder="Enter pincode"
            keyboardType="number-pad"
            placeholderTextColor={BrandColors.text.secondary}
          />
        </View>

        <Text style={styles.sectionTitle}>Pet Experience</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Experience with Pets</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.experienceWithPets}
            onChangeText={(text) => setFormData({ ...formData, experienceWithPets: text })}
            placeholder="Tell us about your experience with pets"
            placeholderTextColor={BrandColors.text.secondary}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Current Pets</Text>
          <TextInput
            style={styles.input}
            value={formData.currentPets}
            onChangeText={(text) => setFormData({ ...formData, currentPets: text })}
            placeholder="Do you currently have any pets?"
            placeholderTextColor={BrandColors.text.secondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Living Situation</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.livingSituation}
            onChangeText={(text) => setFormData({ ...formData, livingSituation: text })}
            placeholder="Describe your living situation (house, apartment, etc.)"
            placeholderTextColor={BrandColors.text.secondary}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Reason for Adoption *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.reasonForAdoption}
            onChangeText={(text) => setFormData({ ...formData, reasonForAdoption: text })}
            placeholder="Why do you want to adopt this pet?"
            placeholderTextColor={BrandColors.text.secondary}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>References</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.references}
            onChangeText={(text) => setFormData({ ...formData, references: text })}
            placeholder="Provide references (optional)"
            placeholderTextColor={BrandColors.text.secondary}
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Icon name="send" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Submit Application</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingInfo: {
    padding: Spacing.md,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  listingTitle: {
    ...Typography.headingMedium,
    color: BrandColors.text.primary,
    marginBottom: Spacing.xs,
  },
  listingSubtitle: {
    ...Typography.bodyMedium,
    color: BrandColors.text.secondary,
  },
  formContainer: {
    padding: Spacing.md,
  },
  sectionTitle: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  input: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.primary.orange,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  submitButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  submitButtonText: {
    ...Typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
});

