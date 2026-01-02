/**
 * Adoption Service Router - Mobile
 * Handles pet adoption flow
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
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

type ViewType = 
  | 'landing'
  | 'center_list'
  | 'center_profile'
  | 'pet_list'
  | 'application'
  | 'confirmation';

interface AdoptionServiceRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  data?: any;
}

interface AdoptionFlow {
  centerId: string | null;
  centerName: string | null;
  petId: string | null;
  petData: any | null;
  applicationId: string | null;
}

export function AdoptionServiceRouter({
  phone,
  onBack,
  onNavigate,
  onViewBooking,
  data,
}: AdoptionServiceRouterProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState<string>('');
  const [centers, setCenters] = useState<any[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<any | null>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<any | null>(null);
  const [applicationData, setApplicationData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    livingSituation: '',
    experience: '',
    reason: '',
  });

  const [adoptionFlow, setAdoptionFlow] = useState<AdoptionFlow>({
    centerId: null,
    centerName: null,
    petId: null,
    petData: null,
    applicationId: null,
  });

  useEffect(() => {
    loadCustomerData();
  }, [phone]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);
      const customer = await CustomerApi.getCustomerByPhone(phone);
      if (customer) {
        setCustomerId(customer.id);
        setApplicationData(prev => ({
          ...prev,
          fullName: customer.name || '',
          email: customer.email || '',
          phone: phone,
        }));
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
      Alert.alert('Error', 'Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const loadCenters = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.searchServices({
        serviceType: 'adoption',
        location: '', // TODO: Get from location service
      });
      setCenters(response.vendors || []);
      setCurrentView('center_list');
    } catch (error) {
      console.error('Error loading centers:', error);
      Alert.alert('Error', 'Failed to load adoption centers');
    } finally {
      setLoading(false);
    }
  };

  const handleCenterSelect = async (center: any) => {
    setSelectedCenter(center);
    setAdoptionFlow(prev => ({
      ...prev,
      centerId: center.id,
      centerName: center.name,
    }));

    try {
      setLoading(true);
      // Load pets from this center
      const response = await CustomerApi.get(`/adoption/center/${center.id}/pets`);
      setPets(response.pets || []);
      setCurrentView('center_profile');
    } catch (error) {
      console.error('Error loading pets:', error);
      Alert.alert('Error', 'Failed to load pets');
    } finally {
      setLoading(false);
    }
  };

  const handleViewPets = () => {
    setCurrentView('pet_list');
  };

  const handlePetSelect = (pet: any) => {
    setSelectedPet(pet);
    setAdoptionFlow(prev => ({
      ...prev,
      petId: pet.id,
      petData: pet,
    }));
    setCurrentView('application');
  };

  const handleApplicationSubmit = async () => {
    if (!applicationData.fullName || !applicationData.email || !applicationData.address) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const response = await CustomerApi.post('/customer/adoption-application', {
        customerPhone: phone,
        centerId: adoptionFlow.centerId,
        centerName: adoptionFlow.centerName,
        petId: adoptionFlow.petId,
        petName: adoptionFlow.petData?.name,
        petBreed: adoptionFlow.petData?.breed,
        petAge: adoptionFlow.petData?.age,
        ...applicationData,
      });

      setAdoptionFlow(prev => ({
        ...prev,
        applicationId: response.applicationId,
      }));
      setCurrentView('confirmation');
    } catch (error) {
      console.error('Error submitting application:', error);
      Alert.alert('Error', 'Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderLanding = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pet Adoption</Text>
        <Text style={styles.subtitle}>Find your perfect companion</Text>
      </View>

      <View style={styles.landingContent}>
        <Text style={styles.landingIcon}>❤️</Text>
        <Text style={styles.landingTitle}>Welcome to Pet Adoption</Text>
        <Text style={styles.landingDescription}>
          Browse through our adoption centers and find your perfect pet companion. 
          Give a loving home to a pet in need.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={loadCenters}
        >
          <Text style={styles.primaryButtonText}>Browse Adoption Centers</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCenterList = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('landing')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Adoption Centers</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <ScrollView style={styles.centerList}>
          {centers.map((center) => (
            <TouchableOpacity
              key={center.id}
              style={styles.centerCard}
              onPress={() => handleCenterSelect(center)}
            >
              <Text style={styles.centerName}>{center.name}</Text>
              <Text style={styles.centerAddress}>{center.address}</Text>
              {center.rating && (
                <Text style={styles.centerRating}>
                  ⭐ {center.rating.toFixed(1)}
                </Text>
              )}
              {center.petCount && (
                <Text style={styles.centerPetCount}>
                  🐾 {center.petCount} pets available
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderCenterProfile = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('center_list')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{selectedCenter?.name}</Text>
      </View>

      <ScrollView style={styles.profileContainer}>
        {selectedCenter?.image && (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imageText}>📷</Text>
          </View>
        )}
        
        <Text style={styles.profileAddress}>{selectedCenter?.address}</Text>
        
        {selectedCenter?.rating && (
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingText}>
              ⭐ {selectedCenter.rating.toFixed(1)} ({selectedCenter.reviewCount || 0} reviews)
            </Text>
          </View>
        )}

        {selectedCenter?.description && (
          <Text style={styles.description}>{selectedCenter.description}</Text>
        )}

        {selectedCenter?.petCount && (
          <View style={styles.petCountContainer}>
            <Text style={styles.petCountText}>
              🐾 {selectedCenter.petCount} pets available for adoption
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleViewPets}
        >
          <Text style={styles.primaryButtonText}>View Available Pets</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderPetList = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('center_profile')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Available Pets</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <ScrollView style={styles.petList}>
          {pets.map((pet) => (
            <TouchableOpacity
              key={pet.id}
              style={styles.petCard}
              onPress={() => handlePetSelect(pet)}
            >
              {pet.image && (
                <View style={styles.petImagePlaceholder}>
                  <Text style={styles.petImageText}>🐾</Text>
                </View>
              )}
              <View style={styles.petInfo}>
                <Text style={styles.petName}>{pet.name}</Text>
                <Text style={styles.petBreed}>{pet.breed}</Text>
                <Text style={styles.petAge}>{pet.age} years old</Text>
                {pet.gender && (
                  <Text style={styles.petGender}>
                    {pet.gender === 'male' ? '♂' : '♀'} {pet.gender}
                  </Text>
                )}
                {pet.description && (
                  <Text style={styles.petDescription} numberOfLines={2}>
                    {pet.description}
                  </Text>
                )}
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderApplication = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('pet_list')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Adoption Application</Text>
      </View>

      <ScrollView style={styles.applicationContainer}>
        {selectedPet && (
          <View style={styles.selectedPetCard}>
            <Text style={styles.selectedPetTitle}>Adopting: {selectedPet.name}</Text>
            <Text style={styles.selectedPetBreed}>{selectedPet.breed}</Text>
          </View>
        )}

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Full Name *</Text>
          <TextInput
            style={styles.formInput}
            value={applicationData.fullName}
            onChangeText={(text) => setApplicationData(prev => ({ ...prev, fullName: text }))}
            placeholder="Enter your full name"
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Email *</Text>
          <TextInput
            style={styles.formInput}
            value={applicationData.email}
            onChangeText={(text) => setApplicationData(prev => ({ ...prev, email: text }))}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Phone</Text>
          <TextInput
            style={styles.formInput}
            value={applicationData.phone}
            onChangeText={(text) => setApplicationData(prev => ({ ...prev, phone: text }))}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Address *</Text>
          <TextInput
            style={[styles.formInput, styles.formTextArea]}
            value={applicationData.address}
            onChangeText={(text) => setApplicationData(prev => ({ ...prev, address: text }))}
            placeholder="Enter your address"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Living Situation</Text>
          <TextInput
            style={[styles.formInput, styles.formTextArea]}
            value={applicationData.livingSituation}
            onChangeText={(text) => setApplicationData(prev => ({ ...prev, livingSituation: text }))}
            placeholder="House, Apartment, etc."
            multiline
            numberOfLines={2}
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Pet Experience</Text>
          <TextInput
            style={[styles.formInput, styles.formTextArea]}
            value={applicationData.experience}
            onChangeText={(text) => setApplicationData(prev => ({ ...prev, experience: text }))}
            placeholder="Tell us about your experience with pets"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Reason for Adoption</Text>
          <TextInput
            style={[styles.formInput, styles.formTextArea]}
            value={applicationData.reason}
            onChangeText={(text) => setApplicationData(prev => ({ ...prev, reason: text }))}
            placeholder="Why do you want to adopt this pet?"
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleApplicationSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Submit Application</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderConfirmation = () => (
    <View style={styles.container}>
      <View style={styles.confirmationContainer}>
        <Text style={styles.confirmationIcon}>✅</Text>
        <Text style={styles.confirmationTitle}>Application Submitted!</Text>
        <Text style={styles.confirmationMessage}>
          Your adoption application has been submitted successfully.
        </Text>
        {adoptionFlow.applicationId && (
          <Text style={styles.confirmationDetails}>
            Application ID: {adoptionFlow.applicationId}
          </Text>
        )}
        {selectedPet && (
          <View style={styles.confirmationPetInfo}>
            <Text style={styles.confirmationPetName}>Pet: {selectedPet.name}</Text>
            <Text style={styles.confirmationPetBreed}>{selectedPet.breed}</Text>
          </View>
        )}
        <Text style={styles.confirmationNote}>
          The adoption center will review your application and contact you soon.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={onBack}>
          <Text style={styles.primaryButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && currentView === 'landing') {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {currentView === 'landing' && renderLanding()}
      {currentView === 'center_list' && renderCenterList()}
      {currentView === 'center_profile' && renderCenterProfile()}
      {currentView === 'pet_list' && renderPetList()}
      {currentView === 'application' && renderApplication()}
      {currentView === 'confirmation' && renderConfirmation()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  backButton: {
    fontSize: typography.body,
    color: '#fff',
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: '#fff',
  },
  title: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.body,
    color: '#fff',
    opacity: 0.9,
  },
  landingContent: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  landingTitle: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  landingDescription: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  centerList: {
    flex: 1,
    padding: spacing.md,
  },
  centerCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  centerName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  centerAddress: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  centerRating: {
    fontSize: typography.body,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  centerPetCount: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  profileContainer: {
    flex: 1,
    padding: spacing.md,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  imageText: {
    fontSize: 48,
  },
  profileAddress: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  ratingContainer: {
    marginBottom: spacing.md,
  },
  ratingText: {
    fontSize: typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  description: {
    fontSize: typography.body,
    color: colors.text,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  petCountContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  petCountText: {
    fontSize: typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  petList: {
    flex: 1,
    padding: spacing.md,
  },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  petImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  petImageText: {
    fontSize: 32,
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  petBreed: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  petAge: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  petGender: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  petDescription: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  applicationContainer: {
    flex: 1,
    padding: spacing.md,
  },
  selectedPetCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  selectedPetTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  selectedPetBreed: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  formSection: {
    marginBottom: spacing.md,
  },
  formLabel: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.body,
    color: colors.text,
    backgroundColor: '#fff',
  },
  formTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  confirmationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  confirmationIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  confirmationTitle: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  confirmationMessage: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  confirmationDetails: {
    fontSize: typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  confirmationPetInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    width: '100%',
  },
  confirmationPetName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  confirmationPetBreed: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  confirmationNote: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    fontStyle: 'italic',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: typography.body,
    fontWeight: 'bold',
  },
});

