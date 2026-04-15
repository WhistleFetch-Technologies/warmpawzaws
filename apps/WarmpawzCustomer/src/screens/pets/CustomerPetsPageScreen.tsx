/**
 * Customer Pets Page Screen - Mobile
 * List all customer pets with quick actions
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface CustomerPetsPageScreenProps {
  phone: string;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onAddPet?: () => void;
}

interface Pet {
  id: string;
  name: string;
  type: string;
  breed?: string;
  age?: number;
  gender?: 'male' | 'female';
  weight?: number;
  image?: string;
}

export function CustomerPetsPageScreen({
  phone,
  onBack,
  onNavigate,
  onAddPet,
}: CustomerPetsPageScreenProps) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPets();
  }, [phone]);

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
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPets();
  };

  const handleAddPet = () => {
    if (onAddPet) {
      onAddPet();
    } else if (onNavigate) {
      onNavigate('AddPet');
    }
  };

  const handlePetPress = (pet: Pet) => {
    if (onNavigate) {
      onNavigate('PetProfileDashboard', { petId: pet.id, pet });
    }
  };

  const renderPetCard = ({ item }: { item: Pet }) => (
    <TouchableOpacity
      style={styles.petCard}
      onPress={() => handlePetPress(item)}
    >
      <View style={styles.petImageContainer}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.petImage} />
        ) : (
          <Text style={styles.petImagePlaceholder}>🐾</Text>
        )}
      </View>
      <View style={styles.petInfo}>
        <View style={styles.petHeader}>
          <View>
            <Text style={styles.petName}>{item.name}</Text>
            <Text style={styles.petBreed}>
              {item.breed || item.type}
            </Text>
          </View>
          <View
            style={[
              styles.genderBadge,
              item.gender === 'male'
                ? styles.genderBadgeMale
                : item.gender === 'female'
                ? styles.genderBadgeFemale
                : styles.genderBadgeUnknown,
            ]}
          >
            <Text
              style={[
                styles.genderBadgeText,
                item.gender === 'male'
                  ? styles.genderBadgeTextMale
                  : item.gender === 'female'
                  ? styles.genderBadgeTextFemale
                  : styles.genderBadgeTextUnknown,
              ]}
            >
              {item.gender === 'male'
                ? '♂ Male'
                : item.gender === 'female'
                ? '♀ Female'
                : 'Unknown'}
            </Text>
          </View>
        </View>
        <View style={styles.petDetails}>
          <View style={styles.petDetailItem}>
            <Text style={styles.petDetailIcon}>📅</Text>
            <Text style={styles.petDetailText}>
              {item.age ? `${item.age} yrs` : 'Age N/A'}
            </Text>
          </View>
          <View style={styles.petDetailItem}>
            <Text style={styles.petDetailIcon}>⚖️</Text>
            <Text style={styles.petDetailText}>
              {item.weight ? `${item.weight} kg` : 'Weight N/A'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenShell style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>My Pets</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddPet}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={pets}
          keyExtractor={(item) => item.id}
          renderItem={renderPetCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🐾</Text>
              <Text style={styles.emptyStateText}>
                You haven't added any pets yet.
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={handleAddPet}
              >
                <Text style={styles.emptyStateButtonText}>
                  Add Your First Pet
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  backButton: {
    marginRight: spacing.md,
  },
  backButtonText: {
    fontSize: typography.body,
    color: colors.white,
  },
  title: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.white,
    flex: 1,
  },
  addButton: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
  },
  petCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
    flexDirection: 'row',
    alignItems: 'center',
  },
  petImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.gray['200'],
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  petImage: {
    width: '100%',
    height: '100%',
  },
  petImagePlaceholder: {
    fontSize: 32,
    textAlign: 'center',
    lineHeight: 64,
  },
  petInfo: {
    flex: 1,
  },
  petHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
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
  },
  genderBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  genderBadgeMale: {
    backgroundColor: '#DBEAFE',
  },
  genderBadgeFemale: {
    backgroundColor: '#FCE7F3',
  },
  genderBadgeUnknown: {
    backgroundColor: colors.gray['100'],
  },
  genderBadgeText: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
  genderBadgeTextMale: {
    color: '#1E40AF',
  },
  genderBadgeTextFemale: {
    color: '#BE185D',
  },
  genderBadgeTextUnknown: {
    color: colors.textSecondary,
  },
  petDetails: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  petDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  petDetailIcon: {
    fontSize: 16,
  },
  petDetailText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyStateText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  emptyStateButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  emptyStateButtonText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
});

