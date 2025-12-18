/**
 * Adoption Listing Screen - Customer Mobile App
 * Browse available pets for adoption
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

interface AdoptionListing {
  id: string;
  petName: string;
  petType: string;
  breed?: string;
  age: number;
  gender: 'male' | 'female';
  location: string;
  shelterName: string;
  shelterId: string;
  images: string[];
  description?: string;
  vaccinationStatus: 'complete' | 'partial' | 'pending';
  spayedNeutered: boolean;
  adoptionFee?: number;
}

export default function AdoptionListingScreen() {
  const navigation = useNavigation();
  const [listings, setListings] = useState<AdoptionListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    petType: 'all',
    gender: 'all',
    ageRange: 'all',
  });

  useEffect(() => {
    loadListings();
  }, [filters]);

  const loadListings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: '50',
        offset: '0',
      });

      if (filters.petType !== 'all') {
        params.append('petType', filters.petType);
      }

      if (filters.gender !== 'all') {
        params.append('gender', filters.gender);
      }

      const response = await fetch(`${API_BASE_URL}/adoption-listings?${params}`, {
        headers: {
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setListings(data.listings || []);
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
    await loadListings();
    setRefreshing(false);
  };

  const handleListingPress = (listing: AdoptionListing) => {
    navigation.navigate('AdoptionApplication' as never, { publicationId: listing.id } as never);
  };

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.centerContainer}>
          <Icon name="pets" size={64} color={BrandColors.text.secondary} />
          <Text style={styles.emptyText}>No adoption listings available</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {listings.map((listing) => (
            <TouchableOpacity
              key={listing.id}
              style={styles.listingCard}
              onPress={() => handleListingPress(listing)}
            >
              {listing.images && listing.images.length > 0 ? (
                <Image source={{ uri: listing.images[0] }} style={styles.listingImage} />
              ) : (
                <View style={styles.listingImagePlaceholder}>
                  <Icon name="pets" size={32} color={BrandColors.text.secondary} />
                </View>
              )}
              <View style={styles.listingInfo}>
                <Text style={styles.petName}>{listing.petName}</Text>
                <Text style={styles.petType}>
                  {listing.petType} {listing.breed && `- ${listing.breed}`}
                </Text>
                <View style={styles.listingDetails}>
                  <View style={styles.detailItem}>
                    <Icon name="cake" size={16} color={BrandColors.text.secondary} />
                    <Text style={styles.detailText}>{listing.age} {listing.age === 1 ? 'year' : 'years'} old</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Icon
                      name={listing.gender === 'male' ? 'male' : 'female'}
                      size={16}
                      color={BrandColors.text.secondary}
                    />
                    <Text style={styles.detailText}>
                      {listing.gender === 'male' ? 'Male' : 'Female'}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Icon name="location-on" size={16} color={BrandColors.text.secondary} />
                    <Text style={styles.detailText}>{listing.location}</Text>
                  </View>
                </View>
                <View style={styles.statusBadges}>
                  <View style={styles.vaccinationBadge}>
                    <Icon
                      name={
                        listing.vaccinationStatus === 'complete'
                          ? 'verified'
                          : listing.vaccinationStatus === 'partial'
                          ? 'warning'
                          : 'error'
                      }
                      size={14}
                      color={
                        listing.vaccinationStatus === 'complete'
                          ? '#4CAF50'
                          : listing.vaccinationStatus === 'partial'
                          ? '#FF9800'
                          : '#F44336'
                      }
                    />
                    <Text style={styles.badgeText}>Vaccinated</Text>
                  </View>
                  {listing.spayedNeutered && (
                    <View style={styles.spayedBadge}>
                      <Icon name="check-circle" size={14} color="#4CAF50" />
                      <Text style={styles.badgeText}>Spayed/Neutered</Text>
                    </View>
                  )}
                </View>
                <View style={styles.listingFooter}>
                  <Text style={styles.shelterName}>{listing.shelterName}</Text>
                  {listing.adoptionFee && (
                    <Text style={styles.adoptionFee}>Adoption Fee: ₹{listing.adoptionFee}</Text>
                  )}
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
  listingCard: {
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
  listingImage: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
  },
  listingImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingInfo: {
    flex: 1,
  },
  petName: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginBottom: Spacing.xs,
  },
  petType: {
    ...Typography.bodyMedium,
    color: BrandColors.text.secondary,
    marginBottom: Spacing.sm,
  },
  listingDetails: {
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
  statusBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.sm,
  },
  vaccinationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#F5F5F5',
    marginRight: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  spayedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#E8F5E9',
    marginRight: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  badgeText: {
    ...Typography.bodyTiny,
    color: BrandColors.text.secondary,
    marginLeft: 4,
    fontWeight: '600',
  },
  listingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shelterName: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
  },
  adoptionFee: {
    ...Typography.bodySmall,
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
});

