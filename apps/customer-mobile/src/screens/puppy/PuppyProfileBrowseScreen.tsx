/**
 * Puppy Profile Browse Screen - Customer Mobile App
 * Browse available puppy profiles from breeders
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { API_BASE_URL, getPublicAnonKey } from '../../config/api';
import ErrorHandler from '../../utils/errorHandler';

interface PuppyProfile {
  id: string;
  name: string;
  breed: string;
  age: number;
  gender: 'male' | 'female';
  price: number;
  location: string;
  breederName: string;
  breederId: string;
  images: string[];
  lineage?: {
    sire?: string;
    dam?: string;
  };
  vaccinationStatus: 'complete' | 'partial' | 'pending';
  nature?: string;
}

export default function PuppyProfileBrowseScreen() {
  const navigation = useNavigation();
  const [profiles, setProfiles] = useState<PuppyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    breed: 'all',
    gender: 'all',
    minPrice: 0,
    maxPrice: 999999,
  });

  useEffect(() => {
    loadProfiles();
  }, [filters]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: '50',
        offset: '0',
      });

      if (filters.breed !== 'all') {
        params.append('breed', filters.breed);
      }

      if (filters.gender !== 'all') {
        params.append('gender', filters.gender);
      }

      const response = await fetch(`${API_BASE_URL}/puppy-profiles?${params}`, {
        headers: {
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfiles(data.profiles || []);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfiles();
    setRefreshing(false);
  };

  const handleProfilePress = (profile: PuppyProfile) => {
    navigation.navigate('PuppyProfileDetail' as never, { profileId: profile.id } as never);
  };

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        </View>
      ) : profiles.length === 0 ? (
        <View style={styles.centerContainer}>
          <Icon name="pets" size={64} color={BrandColors.text.secondary} />
          <Text style={styles.emptyText}>No puppy profiles available</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {profiles.map((profile) => (
            <TouchableOpacity
              key={profile.id}
              style={styles.profileCard}
              onPress={() => handleProfilePress(profile)}
            >
              {profile.images && profile.images.length > 0 ? (
                <Image source={{ uri: profile.images[0] }} style={styles.profileImage} />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Icon name="pets" size={32} color={BrandColors.text.secondary} />
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{profile.name}</Text>
                <Text style={styles.profileBreed}>{profile.breed}</Text>
                <View style={styles.profileDetails}>
                  <View style={styles.detailItem}>
                    <Icon name="cake" size={16} color={BrandColors.text.secondary} />
                    <Text style={styles.detailText}>{profile.age} months</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Icon
                      name={profile.gender === 'male' ? 'male' : 'female'}
                      size={16}
                      color={BrandColors.text.secondary}
                    />
                    <Text style={styles.detailText}>
                      {profile.gender === 'male' ? 'Male' : 'Female'}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Icon name="location-on" size={16} color={BrandColors.text.secondary} />
                    <Text style={styles.detailText}>{profile.location}</Text>
                  </View>
                </View>
                <View style={styles.vaccinationBadge}>
                  <Icon
                    name={
                      profile.vaccinationStatus === 'complete'
                        ? 'verified'
                        : profile.vaccinationStatus === 'partial'
                        ? 'warning'
                        : 'error'
                    }
                    size={14}
                    color={
                      profile.vaccinationStatus === 'complete'
                        ? '#4CAF50'
                        : profile.vaccinationStatus === 'partial'
                        ? '#FF9800'
                        : '#F44336'
                    }
                  />
                  <Text
                    style={[
                      styles.vaccinationText,
                      {
                        color:
                          profile.vaccinationStatus === 'complete'
                            ? '#4CAF50'
                            : profile.vaccinationStatus === 'partial'
                            ? '#FF9800'
                            : '#F44336',
                      },
                    ]}
                  >
                    Vaccination: {profile.vaccinationStatus}
                  </Text>
                </View>
                <View style={styles.profileFooter}>
                  <Text style={styles.profilePrice}>₹{profile.price}</Text>
                  <Text style={styles.breederName}>By {profile.breederName}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
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
  emptyText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.secondary,
    marginTop: Spacing.md,
  },
  listContainer: {
    flex: 1,
  },
  profileCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginBottom: Spacing.xs,
  },
  profileBreed: {
    ...Typography.bodyMedium,
    color: BrandColors.text.secondary,
    marginBottom: Spacing.sm,
  },
  profileDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.md,
    marginBottom: Spacing.xs,
  },
  detailText: {
    ...Typography.bodyTiny,
    color: BrandColors.text.secondary,
    marginLeft: 4,
  },
  vaccinationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#F5F5F5',
    marginBottom: Spacing.sm,
  },
  vaccinationText: {
    ...Typography.bodyTiny,
    marginLeft: 4,
    fontWeight: '600',
  },
  profileFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profilePrice: {
    ...Typography.headingSmall,
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  breederName: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
  },
});

