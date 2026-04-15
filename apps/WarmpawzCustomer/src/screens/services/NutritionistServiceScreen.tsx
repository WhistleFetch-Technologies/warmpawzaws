/**
 * Nutritionist Service Screen - Mobile
 * Nutritionist consultation booking and management
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface NutritionistServiceScreenProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function NutritionistServiceScreen({
  phone,
  onBack,
  onNavigate,
}: NutritionistServiceScreenProps) {
  const [loading, setLoading] = useState(true);
  const [nutritionists, setNutritionists] = useState<any[]>([]);
  const [selectedNutritionist, setSelectedNutritionist] = useState<any>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<string>('');
  const [consultationType, setConsultationType] = useState<'initial' | 'followup'>('initial');
  const [specialInstructions, setSpecialInstructions] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [nutritionistsResult, petsResult] = await Promise.all([
        CustomerApi.searchServices({ serviceType: 'nutritionist' }).catch(() => ({ vendors: [] })),
        CustomerApi.getPets(phone).catch(() => []),
      ]);

      setNutritionists(
        Array.isArray(nutritionistsResult) 
          ? nutritionistsResult 
          : nutritionistsResult.vendors || nutritionistsResult.nutritionists || []
      );

      const petsData = Array.isArray(petsResult) ? petsResult : petsResult.pets || [];
      setPets(petsData);
      if (petsData.length === 1) {
        setSelectedPet(petsData[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load nutritionists');
    } finally {
      setLoading(false);
    }
  };

  const handleBookConsultation = async () => {
    if (!selectedNutritionist) {
      Alert.alert('Required', 'Please select a nutritionist');
      return;
    }
    if (!selectedPet) {
      Alert.alert('Required', 'Please select a pet');
      return;
    }

    try {
      const bookingData = {
        phone,
        vendorId: selectedNutritionist.id,
        serviceId: selectedNutritionist.serviceId || selectedNutritionist.id,
        petId: selectedPet,
        serviceType: 'nutritionist',
        consultationType,
        specialInstructions,
      };

      const response = await CustomerApi.createBooking(bookingData);
      
      if (response.bookingId) {
        Alert.alert('Success', 'Consultation booked successfully', [
          {
            text: 'OK',
            onPress: () => onNavigate?.('BookingDetail', { bookingId: response.bookingId }),
          },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to book consultation');
    }
  };

  if (loading) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading nutritionists...</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nutrition Services</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Service Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Service</Text>
          <View style={styles.serviceTypeContainer}>
            <TouchableOpacity
              style={styles.serviceTypeCard}
              onPress={() => {
                // Show consultation booking
                // (existing flow)
              }}
            >
              <Icon name="stethoscope" size={32} color={colors.primary} />
              <Text style={styles.serviceTypeTitle}>Consultation</Text>
              <Text style={styles.serviceTypeDescription}>Book a nutrition consultation</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.serviceTypeCard}
              onPress={() => {
                if (onNavigate) {
                  // Check if we have nutritionists, if yes go to ordering, if no go to orders list
                  if (nutritionists.length > 0) {
                    onNavigate('MealPlanOrderScreen', { 
                      vendorId: nutritionists[0].id || nutritionists[0].vendorId 
                    });
                  } else {
                    // Show option to view orders or order new
                    Alert.alert(
                      'Meal Plans',
                      'Would you like to order a new meal plan or view your existing orders?',
                      [
                        { text: 'View Orders', onPress: () => onNavigate('MealPlanOrders') },
                        { text: 'Order New', onPress: () => onNavigate('ServiceDiscovery') },
                        { text: 'Cancel', style: 'cancel' },
                      ]
                    );
                  }
                }
              }}
            >
              <Icon name="food" size={32} color={colors.primary} />
              <Text style={styles.serviceTypeTitle}>Meal Plans</Text>
              <Text style={styles.serviceTypeDescription}>Order custom meal plans</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Consultation Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consultation Type</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                consultationType === 'initial' && styles.typeButtonActive,
              ]}
              onPress={() => setConsultationType('initial')}
            >
              <Icon 
                name="account-plus" 
                size={24} 
                color={consultationType === 'initial' ? colors.white : colors.text} 
              />
              <Text
                style={[
                  styles.typeButtonText,
                  consultationType === 'initial' && styles.typeButtonTextActive,
                ]}
              >
                Initial Consultation
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                consultationType === 'followup' && styles.typeButtonActive,
              ]}
              onPress={() => setConsultationType('followup')}
            >
              <Icon 
                name="account-check" 
                size={24} 
                color={consultationType === 'followup' ? colors.white : colors.text} 
              />
              <Text
                style={[
                  styles.typeButtonText,
                  consultationType === 'followup' && styles.typeButtonTextActive,
                ]}
              >
                Follow-up
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pet Selection */}
        {pets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Pet</Text>
            {pets.map((pet) => (
              <TouchableOpacity
                key={pet.id}
                style={[
                  styles.petCard,
                  selectedPet === pet.id && styles.petCardSelected,
                ]}
                onPress={() => setSelectedPet(pet.id)}
              >
                <View style={styles.petInfo}>
                  <Text style={styles.petName}>{pet.name}</Text>
                  <Text style={styles.petDetails}>
                    {pet.breed || pet.type} • {pet.age ? `${pet.age} years` : 'Age not set'}
                  </Text>
                </View>
                {selectedPet === pet.id && (
                  <Icon name="check-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Nutritionist Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Nutritionists</Text>
          {nutritionists.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="account-question" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No nutritionists available</Text>
            </View>
          ) : (
            nutritionists.map((nutritionist) => (
              <TouchableOpacity
                key={nutritionist.id}
                style={[
                  styles.nutritionistCard,
                  selectedNutritionist?.id === nutritionist.id && styles.nutritionistCardSelected,
                ]}
                onPress={() => setSelectedNutritionist(nutritionist)}
              >
                <View style={styles.nutritionistInfo}>
                  <Text style={styles.nutritionistName}>{nutritionist.name}</Text>
                  {nutritionist.qualifications && (
                    <Text style={styles.nutritionistQuals}>{nutritionist.qualifications}</Text>
                  )}
                  {nutritionist.experience && (
                    <Text style={styles.nutritionistExp}>
                      {nutritionist.experience} years experience
                    </Text>
                  )}
                  {nutritionist.rating && (
                    <View style={styles.ratingContainer}>
                      <Icon name="star" size={16} color="#fbbf24" />
                      <Text style={styles.rating}>{nutritionist.rating}</Text>
                    </View>
                  )}
                </View>
                {selectedNutritionist?.id === nutritionist.id && (
                  <Icon name="check-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Special Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Instructions (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Any specific concerns or dietary requirements..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
          />
        </View>

        {/* Book Button */}
        <TouchableOpacity
          style={[
            styles.bookButton,
            (!selectedNutritionist || !selectedPet) && styles.bookButtonDisabled,
          ]}
          onPress={handleBookConsultation}
          disabled={!selectedNutritionist || !selectedPet}
        >
          <Text style={styles.bookButtonText}>Book Consultation</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
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
  headerTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    fontWeight: typography.fontWeights.medium,
  },
  typeButtonTextActive: {
    color: colors.white,
  },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  petCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: `${colors.primary}10`,
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  petDetails: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  nutritionistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  nutritionistCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: `${colors.primary}10`,
  },
  nutritionistInfo: {
    flex: 1,
  },
  nutritionistName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  nutritionistQuals: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  nutritionistExp: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs / 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  rating: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    fontWeight: typography.fontWeights.medium,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: colors.white,
  },
  bookButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  bookButtonDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.5,
  },
  bookButtonText: {
    color: colors.white,
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  serviceTypeContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  serviceTypeCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  serviceTypeTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  serviceTypeDescription: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

