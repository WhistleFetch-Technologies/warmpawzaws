/**
 * Pet Selection Screen - Customer Mobile App
 * Select a pet for booking
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getServiceStyleFromService, getDefaultServiceStyleForRole } from '../../utils/serviceStyleMapping';

interface Pet {
  id: string;
  name: string;
  type: string;
  breed?: string;
  age?: number;
  photo?: string;
}

interface PetSelectionScreenProps {
  route?: {
    params?: {
      vendorId?: string;
      vendorName?: string;
      roleId?: string;
      problemId?: string;
      services?: any[];
      serviceType?: 'center' | 'home' | 'tele';
    };
  };
  navigation?: any;
}

export default function PetSelectionScreen({
  route,
  navigation,
}: PetSelectionScreenProps) {
  const { user } = useAuth();
  const vendorId = route?.params?.vendorId || '';
  const vendorName = route?.params?.vendorName || '';
  const roleId = route?.params?.roleId || '';
  const problemId = route?.params?.problemId;
  const services = route?.params?.services || [];

  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);

  useEffect(() => {
    loadPets();
  }, []);

  const loadPets = async () => {
    try {
      setLoading(true);
      const phone = user?.phone?.replace(/[^0-9]/g, '') || '';
      
      if (!phone) {
        Alert.alert('Error', 'User phone number not found');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/pets?phone=${phone}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPets(data.pets || []);
        
        if (data.pets && data.pets.length === 0) {
          Alert.alert(
            'No Pets',
            'You need to add a pet first. Would you like to add one now?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => navigation?.goBack() },
              {
                text: 'Add Pet',
                onPress: () => navigation?.navigate('AddPet', { returnTo: 'PetSelection' }),
              },
            ]
          );
        }
      } else {
        Alert.alert('Error', 'Failed to load pets');
      }
    } catch (error) {
      console.error('Error loading pets:', error);
      Alert.alert('Error', 'Cannot connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!selectedPet) {
      Alert.alert('Select Pet', 'Please select a pet');
      return;
    }

    // Determine service type from route params, services, or default for role
    let serviceType: 'center' | 'home' | 'tele' = route?.params?.serviceType || 'center';
    
    if (!serviceType && services && services.length > 0) {
      // Try to get service style from first service
      serviceType = getServiceStyleFromService(services[0]);
    }
    
    if (!serviceType) {
      // Fallback to default for role
      serviceType = getDefaultServiceStyleForRole(roleId);
    }

    // Navigate to time slot selection
    navigation?.navigate('TimeSlotSelection', {
      vendorId,
      serviceId: services[0]?.id || '',
      serviceType,
      petId: selectedPet.id,
      services,
      isPackage: services[0]?.isPackage || false,
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading pets...
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[Typography.h2, styles.headerTitle]}>Select Pet</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              Choose the pet for this booking
            </Text>
          </View>
        </View>

        {/* Pets List */}
        {pets.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="pets" size={64} color={BrandColors.neutral.gray300} />
            <Text style={[Typography.h3, styles.emptyText]}>No pets found</Text>
            <Text style={[Typography.bodySmall, styles.emptySubtext]}>
              Add a pet to continue with booking
            </Text>
            <BrandedButton
              title="Add Pet"
              onPress={() => navigation?.navigate('AddPet', { returnTo: 'PetSelection' })}
              style={styles.addButton}
            />
          </View>
        ) : (
          <View style={styles.petsList}>
            {pets.map((pet) => {
              const isSelected = selectedPet?.id === pet.id;
              return (
                <TouchableOpacity
                  key={pet.id}
                  style={[styles.petCard, isSelected && styles.petCardSelected]}
                  onPress={() => setSelectedPet(pet)}
                  activeOpacity={0.7}
                >
                  <View style={styles.petLeft}>
                    <View style={styles.petAvatar}>
                      {pet.photo ? (
                        <Text style={styles.petAvatarText}>📷</Text>
                      ) : (
                        <Icon name="pets" size={32} color={BrandColors.primary.orange} />
                      )}
                    </View>
                    <View style={styles.petInfo}>
                      <Text style={[Typography.h4, styles.petName]}>{pet.name}</Text>
                      <Text style={[Typography.bodySmall, styles.petDetails]}>
                        {pet.type}
                        {pet.breed && ` • ${pet.breed}`}
                        {pet.age && ` • ${pet.age} years old`}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}
                  >
                    {isSelected && (
                      <Icon name="check" size={20} color="#FFFFFF" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Continue Button */}
      {pets.length > 0 && (
        <View style={styles.footer}>
          <BrandedButton
            title={selectedPet ? `Continue with ${selectedPet.name}` : 'Select a Pet'}
            onPress={handleContinue}
            disabled={!selectedPet}
            fullWidth
          />
        </View>
      )}
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
    paddingBottom: Spacing.xl + 80,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    color: BrandColors.neutral.gray600,
  },
  petsList: {
    padding: Spacing.lg,
    gap: Spacing.base,
  },
  petCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
  },
  petCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  petLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    flex: 1,
  },
  petAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BrandColors.primary.orange + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  petAvatarText: {
    fontSize: 24,
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  petDetails: {
    color: BrandColors.neutral.gray600,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: BrandColors.primary.orange,
    borderColor: BrandColors.primary.orange,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    minHeight: 400,
  },
  emptyText: {
    color: BrandColors.neutral.gray900,
    marginTop: Spacing.base,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  addButton: {
    marginTop: Spacing.base,
  },
  footer: {
    padding: Spacing.lg,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
});

