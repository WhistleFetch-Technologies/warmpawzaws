/**
 * Customer Home Screen
 * Main landing page with all service options
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

const { width } = Dimensions.get('window');

interface CustomerHomeScreenProps {
  phone: string;
  onNavigate: (screen: string) => void;
  onProfileClick?: () => void;
  onPetClick?: (petId: string) => void;
  onAddPet?: () => void;
}

interface Pet {
  id: string;
  name: string;
  type: string;
  breed?: string;
  photo?: string;
}

interface UserData {
  name: string;
  phone: string;
  pets: Pet[];
  photo?: string;
}

export function CustomerHomeScreen({
  phone,
  onNavigate,
  onProfileClick,
  onPetClick,
  onAddPet,
}: CustomerHomeScreenProps) {
  const [userData, setUserData] = useState<UserData>({
    name: 'User',
    phone: '',
    pets: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [currentBanner, setCurrentBanner] = useState(0);

  // Cleanup
  useEffect(() => {
    loadUserData();

    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % 3);
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [phone]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      
      const [profileResult, petsResult] = await Promise.all([
        CustomerApi.getProfile(phone).catch(() => null),
        CustomerApi.getPets(phone).catch(() => null),
      ]);

      if (profileResult?.profile) {
        setUserData((prev) => ({
          ...prev,
          name: profileResult.profile.firstName || 'User',
          phone: phone,
          photo: profileResult.profile.photo,
        }));
      }

      if (petsResult) {
        const pets = Array.isArray(petsResult) ? petsResult : 
                    Array.isArray(petsResult.pets) ? petsResult.pets : [];
        setUserData((prev) => ({
          ...prev,
          pets: pets,
        }));
        if (pets.length > 0 && !selectedPet) {
          setSelectedPet(pets[0]);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickServices = [
    { icon: '🏥', label: 'Vet Care', color: '#3b82f6', screen: 'vet' },
    { icon: '✂️', label: 'Grooming', color: '#f97316', screen: 'grooming' },
    { icon: '🛍️', label: 'Shop', color: '#ec4899', screen: 'shop' },
    { icon: '🎓', label: 'Training', color: '#8b5cf6', screen: 'training' },
    { icon: '🚶', label: 'Walker', color: '#10b981', screen: 'walker' },
    { icon: '🏠', label: 'Boarding', color: '#6366f1', screen: 'boarding' },
    { icon: '❤️', label: 'Adoption', color: '#ef4444', screen: 'adoption' },
    { icon: '☕', label: 'Pet Cafes', color: '#f59e0b', screen: 'cafes' },
  ];

  const banners = [
    {
      title: 'Get 50% OFF',
      subtitle: 'First Grooming Session',
      emoji: '✂️',
    },
    {
      title: 'Free Health Checkup',
      subtitle: 'Book Vet Appointment Today',
      emoji: '🏥',
    },
    {
      title: 'Premium Pet Food',
      subtitle: '20% OFF on First Order',
      emoji: '🍖',
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={onProfileClick}
            style={styles.profileButton}
          >
            {userData.photo ? (
              <Image source={{ uri: userData.photo }} style={styles.profileImage} />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profileInitial}>
                  {userData.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Hi, {userData.name}! 👋</Text>
            <Text style={styles.subtitle}>Explore WarmPawz Services</Text>
          </View>
          <TouchableOpacity
            onPress={() => onNavigate('cart')}
            style={styles.cartButton}
          >
            <Text style={styles.cartIcon}>🛒</Text>
          </TouchableOpacity>
        </View>

        {/* Pet Selector */}
        {userData.pets.length > 0 && (
          <View style={styles.petsSection}>
            <View style={styles.petsHeader}>
              <Text style={styles.petsTitle}>Your Pets</Text>
              <TouchableOpacity onPress={onAddPet}>
                <Text style={styles.addPetText}>+ Add Pet</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petsList}>
              {userData.pets.map((pet) => (
                <TouchableOpacity
                  key={pet.id}
                  style={[
                    styles.petCard,
                    selectedPet?.id === pet.id && styles.petCardSelected,
                  ]}
                  onPress={() => {
                    setSelectedPet(pet);
                    onPetClick?.(pet.id);
                  }}
                >
                  {pet.photo ? (
                    <Image source={{ uri: pet.photo }} style={styles.petImage} />
                  ) : (
                    <View style={styles.petPlaceholder}>
                      <Text style={styles.petEmoji}>
                        {pet.type === 'dog' ? '🐕' : pet.type === 'cat' ? '🐈' : '🐾'}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.petName}>{pet.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Banner */}
      <View style={styles.bannerContainer}>
        <View style={styles.banner}>
          <Text style={styles.bannerEmoji}>{banners[currentBanner].emoji}</Text>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>{banners[currentBanner].title}</Text>
            <Text style={styles.bannerSubtitle}>{banners[currentBanner].subtitle}</Text>
          </View>
        </View>
      </View>

      {/* Quick Services Grid */}
      <View style={styles.servicesSection}>
        <Text style={styles.sectionTitle}>Quick Services</Text>
        <View style={styles.servicesGrid}>
          {quickServices.map((service, index) => (
            <TouchableOpacity
              key={index}
              style={styles.serviceCard}
              onPress={() => onNavigate(service.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.serviceIcon, { backgroundColor: `${service.color}20` }]}>
                <Text style={styles.serviceIconEmoji}>{service.icon}</Text>
              </View>
              <Text style={styles.serviceLabel}>{service.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Additional sections can be added here */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profilePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: '#fff',
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: '#fff',
    opacity: 0.9,
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartIcon: {
    fontSize: 20,
  },
  petsSection: {
    marginTop: spacing.md,
  },
  petsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  petsTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: '#fff',
  },
  addPetText: {
    fontSize: typography.fontSizes.xs,
    color: '#fff',
    opacity: 0.9,
  },
  petsList: {
    marginTop: spacing.sm,
  },
  petCard: {
    width: 80,
    marginRight: spacing.sm,
    alignItems: 'center',
  },
  petCardSelected: {
    opacity: 1,
  },
  petImage: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.full,
  },
  petPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  petEmoji: {
    fontSize: 30,
  },
  petName: {
    fontSize: typography.fontSizes.xs,
    color: '#fff',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  bannerContainer: {
    padding: spacing.lg,
  },
  banner: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerEmoji: {
    fontSize: 40,
    marginRight: spacing.md,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  bannerSubtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  servicesSection: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  serviceCard: {
    width: (width - spacing.lg * 3) / 4,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  serviceIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  serviceIconEmoji: {
    fontSize: 28,
  },
  serviceLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.text,
    textAlign: 'center',
  },
});

