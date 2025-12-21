/**
 * Customer Pet Profile Screen
 * Create and manage pet profiles
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
  Modal,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface CustomerPetProfileScreenProps {
  phone: string;
  onComplete: (pets: Pet[]) => void;
  onBack?: () => void;
}

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  age: string;
  gender: string;
  weight: string;
  color?: string;
  photo?: string;
  microchipId?: string;
  medicalHistory?: string;
  healthRecords?: {
    lastCheckup?: string;
    allergies?: string;
    medications?: string;
    conditions?: string;
  };
  vaccinations?: {
    rabies?: string;
    distemper?: string;
    parvovirus?: string;
    other?: string;
  };
}

export function CustomerPetProfileScreen({
  phone,
  onComplete,
  onBack,
}: CustomerPetProfileScreenProps) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [currentPet, setCurrentPet] = useState<Partial<Pet>>({
    name: '',
    type: 'Dog',
    breed: '',
    age: '',
    gender: '',
    weight: '',
    color: '',
    photo: '',
    microchipId: '',
    medicalHistory: '',
    healthRecords: {
      lastCheckup: '',
      allergies: '',
      medications: '',
      conditions: '',
    },
    vaccinations: {
      rabies: '',
      distemper: '',
      parvovirus: '',
      other: '',
    },
  });
  const [photoPreview, setPhotoPreview] = useState<string>('');

  useEffect(() => {
    loadPets();
    return () => {
      setPets([]);
      setCurrentPet({
        name: '',
        type: 'Dog',
        breed: '',
        age: '',
        gender: '',
        weight: '',
      });
      setPhotoPreview('');
    };
  }, []);

  const loadPets = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getPets(phone);
      const petsData = Array.isArray(response) ? response : response.pets || [];
      setPets(petsData);
    } catch (error) {
      console.error('Error loading pets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPet = () => {
    setEditingPet(null);
    setCurrentPet({
      name: '',
      type: 'Dog',
      breed: '',
      age: '',
      gender: '',
      weight: '',
      color: '',
      photo: '',
      microchipId: '',
      medicalHistory: '',
      healthRecords: {
        lastCheckup: '',
        allergies: '',
        medications: '',
        conditions: '',
      },
      vaccinations: {
        rabies: '',
        distemper: '',
        parvovirus: '',
        other: '',
      },
    });
    setPhotoPreview('');
    setShowAddModal(true);
  };

  const handleEditPet = (pet: Pet) => {
    setEditingPet(pet);
    setCurrentPet(pet);
    setPhotoPreview(pet.photo || '');
    setShowAddModal(true);
  };

  const handleDeletePet = async (petId: string) => {
    Alert.alert(
      'Delete Pet',
      'Are you sure you want to remove this pet?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await CustomerApi.deletePet(petId);
              setPets(pets.filter((p) => p.id !== petId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete pet. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSavePet = async () => {
    if (!currentPet.name || !currentPet.type || !currentPet.breed || !currentPet.age) {
      Alert.alert('Required', 'Please fill in all required fields (Name, Type, Breed, Age)');
      return;
    }

    setLoading(true);
    try {
      const petId = editingPet?.id || `pet_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const petData: Pet = {
        id: petId,
        name: currentPet.name!,
        type: currentPet.type!,
        breed: currentPet.breed!,
        age: currentPet.age!,
        gender: currentPet.gender || '',
        weight: currentPet.weight || '',
        color: currentPet.color,
        photo: currentPet.photo,
        microchipId: currentPet.microchipId,
        medicalHistory: currentPet.medicalHistory,
        healthRecords: currentPet.healthRecords,
        vaccinations: currentPet.vaccinations,
      };

      if (editingPet) {
        await CustomerApi.updatePet(petId, petData);
        setPets(pets.map((p) => (p.id === petId ? petData : p)));
      } else {
        await CustomerApi.addPet(phone, petData);
        setPets([...pets, petData]);
      }

      setShowAddModal(false);
      setEditingPet(null);
      setCurrentPet({
        name: '',
        type: 'Dog',
        breed: '',
        age: '',
        gender: '',
        weight: '',
      });
      setPhotoPreview('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save pet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (pets.length === 0) {
      Alert.alert('Required', 'Please add at least one pet profile');
      return;
    }

    setLoading(true);
    try {
      // Save all pets
      await CustomerApi.addPet(phone, pets as any);
      onComplete(pets);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save pets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = () => {
    Alert.alert(
      'Photo Upload',
      'Image picker will be available after installing expo-image-picker package.',
      [{ text: 'OK' }]
    );
  };

  const renderPetList = () => (
    <>
      <View style={styles.logoContainer}>
        <Text style={styles.logoEmoji}>🐾</Text>
      </View>
      <View style={styles.iconSection}>
        <View style={styles.orangeCircle}>
          <Text style={styles.iconText}>🐾</Text>
        </View>
        <Text style={styles.title}>Create Pet{'\n'}Profile(s) 🐾</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.description}>
          Add your furry family members 💕{'\n'}You can add multiple pets
        </Text>

        {pets.length > 0 ? (
          <View style={styles.petsContainer}>
            {pets.map((pet) => (
              <View key={pet.id} style={styles.petCard}>
                <View style={styles.petCardContent}>
                  <View style={styles.petPhotoContainer}>
                    {pet.photo ? (
                      <Image source={{ uri: pet.photo }} style={styles.petPhoto} />
                    ) : (
                      <Text style={styles.petPhotoPlaceholder}>
                        {pet.type === 'Dog' ? '🐕' : pet.type === 'Cat' ? '🐈' : '🐾'}
                      </Text>
                    )}
                  </View>
                  <View style={styles.petInfo}>
                    <Text style={styles.petName}>{pet.name}</Text>
                    <Text style={styles.petDetails}>
                      {pet.breed} • {pet.age} {pet.age === '1' ? 'year' : 'years'} • {pet.gender}
                    </Text>
                    <View style={styles.petActions}>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => handleEditPet(pet)}
                      >
                        <Text style={styles.editButtonText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeletePet(pet.id)}
                      >
                        <Text style={styles.deleteButtonText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>🐾</Text>
            <Text style={styles.emptyStateText}>
              No pets added yet.{'\n'}Click below to add your first pet!
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.addPetButton} onPress={handleAddPet}>
          <Text style={styles.addPetButtonText}>+ Add Pet</Text>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 You can add as many pets as you have!{'\n'}Each pet gets their own health & booking
            history.
          </Text>
        </View>
      </View>
    </>
  );

  const renderAddPetModal = () => (
    <Modal visible={showAddModal} animationType="slide" transparent={true}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingPet ? 'Edit Pet' : 'Add Pet'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.photoSection}>
              <TouchableOpacity style={styles.photoContainer} onPress={handlePhotoUpload}>
                {photoPreview ? (
                  <Image source={{ uri: photoPreview }} style={styles.photoImage} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoIcon}>📷</Text>
                    <Text style={styles.photoText}>Upload Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>
                Pet Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter pet name"
                value={currentPet.name}
                onChangeText={(text) => setCurrentPet({ ...currentPet, name: text })}
              />

              <Text style={styles.label}>
                Type <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.typeButtons}>
                {['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      currentPet.type === type && styles.typeButtonSelected,
                    ]}
                    onPress={() => setCurrentPet({ ...currentPet, type })}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        currentPet.type === type && styles.typeButtonTextSelected,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>
                Breed <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter breed"
                value={currentPet.breed}
                onChangeText={(text) => setCurrentPet({ ...currentPet, breed: text })}
              />

              <Text style={styles.label}>
                Age <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter age in years"
                value={currentPet.age}
                onChangeText={(text) => setCurrentPet({ ...currentPet, age: text })}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Gender</Text>
              <View style={styles.genderButtons}>
                {['Male', 'Female'].map((gender) => (
                  <TouchableOpacity
                    key={gender}
                    style={[
                      styles.genderButton,
                      currentPet.gender === gender && styles.genderButtonSelected,
                    ]}
                    onPress={() => setCurrentPet({ ...currentPet, gender })}
                  >
                    <Text
                      style={[
                        styles.genderButtonText,
                        currentPet.gender === gender && styles.genderButtonTextSelected,
                      ]}
                    >
                      {gender}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter weight"
                value={currentPet.weight}
                onChangeText={(text) => setCurrentPet({ ...currentPet, weight: text })}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Color</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter color"
                value={currentPet.color}
                onChangeText={(text) => setCurrentPet({ ...currentPet, color: text })}
              />

              <Text style={styles.label}>Microchip ID</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter microchip ID (optional)"
                value={currentPet.microchipId}
                onChangeText={(text) => setCurrentPet({ ...currentPet, microchipId: text })}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSavePet}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {editingPet ? 'Update Pet' : 'Save Pet'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );

  if (loading && pets.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading pets...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderPetList()}

        <View style={styles.navigationContainer}>
          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack} disabled={loading}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.completeButton, loading && styles.completeButtonDisabled]}
            onPress={handleComplete}
            disabled={loading || pets.length === 0}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.completeButtonText}>Complete</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {renderAddPetModal()}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
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
  petsContainer: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  petCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  petCardContent: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  petPhotoContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.lg,
    backgroundColor: '#FFF4E6',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  petPhoto: {
    width: '100%',
    height: '100%',
  },
  petPhotoPlaceholder: {
    fontSize: 32,
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
    marginBottom: spacing.sm,
  },
  petActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#EFF6FF',
    borderRadius: borderRadius.md,
  },
  editButtonText: {
    fontSize: typography.fontSizes.xs,
    color: '#3B82F6',
  },
  deleteButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#FEF2F2',
    borderRadius: borderRadius.md,
  },
  deleteButtonText: {
    fontSize: typography.fontSizes.xs,
    color: '#DC2626',
  },
  emptyState: {
    backgroundColor: '#FFF4E6',
    borderWidth: 2,
    borderColor: '#FFE0B2',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  addPetButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: '#FFF4E6',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addPetButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.primary,
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  infoText: {
    fontSize: typography.fontSizes.xs,
    color: '#1E40AF',
    textAlign: 'center',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  backButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  completeButton: {
    flex: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonDisabled: {
    opacity: 0.5,
  },
  completeButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: '#ffffff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: typography.fontSizes.lg,
    color: colors.text,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  photoContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF4E6',
    borderWidth: 4,
    borderColor: colors.background,
    overflow: 'hidden',
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
    fontSize: 32,
    marginBottom: spacing.xs / 2,
  },
  photoText: {
    fontSize: typography.fontSizes.xs,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  formSection: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
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
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  typeButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF4E6',
  },
  typeButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  typeButtonTextSelected: {
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  genderButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  genderButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  genderButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF4E6',
  },
  genderButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  genderButtonTextSelected: {
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: '#ffffff',
  },
});

