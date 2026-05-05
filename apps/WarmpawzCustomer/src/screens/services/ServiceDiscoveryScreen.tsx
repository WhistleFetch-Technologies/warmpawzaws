/**
 * Service Discovery Screen
 * Main service search and discovery
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
  TextInput,
  FlatList,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import { formatDistanceDisplay } from '../../utils/distance-display';
import { customerFacingRating } from '../../utils/rating-display';

interface ServiceDiscoveryScreenProps {
  phone: string;
  onSelectVendor: (vendorId: string) => void;
  onBack?: () => void;
}

const CATEGORIES = [
  { id: 'vet', name: 'Veterinary', icon: '🏥', color: colors.error + 20% opacity },
  { id: 'grooming', name: 'Grooming', icon: '✂️', color: '#DBEAFE' },
  { id: 'training', name: 'Training', icon: '🎓', color: '#E9D5FF' },
  { id: 'walker', name: 'Walking', icon: '🚶', color: '#D1FAE5' },
  { id: 'boarding', name: 'Boarding', icon: '🏠', color: '#FEF3C7' },
  { id: 'nutrition', name: 'Nutrition', icon: '🍖', color: '#FFE4D6' },
  { id: 'adoption', name: 'Adoption', icon: '❤️', color: '#FCE7F3' },
  { id: 'marketplace', name: 'Shop', icon: '🛍️', color: '#E0E7FF' },
];

export function ServiceDiscoveryScreen({
  phone,
  onSelectVendor,
  onBack,
}: ServiceDiscoveryScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    location: '',
    minRating: '',
    sortBy: 'rating',
  });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    setUserLocation({ lat: 12.9716, lng: 77.5946 });
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      searchVendors();
    }
  }, [selectedCategory, filters]);

  const searchVendors = async () => {
    if (!selectedCategory) return;

    try {
      setLoading(true);
      const response = await CustomerApi.searchServices({
        serviceType: selectedCategory,
        location: filters.location || (userLocation ? `${userLocation.lat},${userLocation.lng}` : ''),
        latitude: userLocation?.lat,
        longitude: userLocation?.lng,
        minRating: filters.minRating ? parseFloat(filters.minRating) : undefined,
        sortBy: filters.sortBy,
      });
      setVendors(response.vendors || []);
    } catch (error) {
      console.error('Error searching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderCategoryGrid = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>What does your pet need?</Text>
        <Text style={styles.headerSubtitle}>Find trusted pet care services near you</Text>
      </View>

      <FlatList
        data={CATEGORIES}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.categoryGrid}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryCard, { backgroundColor: item.color }]}
            onPress={() => setSelectedCategory(item.id)}
          >
            <Text style={styles.categoryIcon}>{item.icon}</Text>
            <Text style={styles.categoryName}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderVendorList = () => (
    <View style={styles.container}>
      <View style={styles.searchHeader}>
        {onBack && (
          <TouchableOpacity onPress={() => setSelectedCategory(null)} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search services..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <TextInput
          style={styles.filterInput}
          placeholder="Location"
          value={filters.location}
          onChangeText={(text) => setFilters({ ...filters, location: text })}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={vendors}
          keyExtractor={(item) => item.id || item.vendorId}
          contentContainerStyle={styles.vendorList}
          renderItem={({ item }) => {
            const face = customerFacingRating(
              item.rating,
              item.reviewCount ?? item.review_count
            );
            return (
            <TouchableOpacity
              style={styles.vendorCard}
              onPress={() =>
                onSelectVendor(
                  pickCustomerVendorAccountId(item as Record<string, unknown>) ||
                    String(item.vendorId || item.id || '')
                )
              }
            >
              <View style={styles.vendorHeader}>
                <View style={styles.vendorInfo}>
                  <Text style={styles.vendorName}>{item.name || item.businessName}</Text>
                  <Text style={styles.vendorCategory}>
                    {CATEGORIES.find((c) => c.id === selectedCategory)?.name}
                  </Text>
                </View>
                {face != null && (
                  <View style={styles.ratingContainer}>
                    <Text style={styles.ratingText}>⭐ {face.toFixed(1)}</Text>
                  </View>
                )}
              </View>
              {item.address && (
                <Text style={styles.vendorAddress}>📍 {item.address}</Text>
              )}
              {formatDistanceDisplay(item) && (
                <Text style={styles.vendorDistance}>{formatDistanceDisplay(item)}</Text>
              )}
            </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No vendors found</Text>
            </View>
          }
        />
      )}
    </View>
  );

  return (
    <ScreenShell style={styles.container}>
      {!selectedCategory ? renderCategoryGrid() : renderVendorList()}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  categoryGrid: {
    padding: spacing.md,
    gap: spacing.md,
  },
  categoryCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    margin: spacing.xs,
    borderWidth: 2,
    borderColor: colors.border,
  },
  categoryIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  categoryName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  searchContainer: {
    flex: 1,
  },
  searchInput: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.fontSizes.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
  filtersContainer: {
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  vendorList: {
    padding: spacing.md,
  },
  vendorCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  vendorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  vendorCategory: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  ratingContainer: {
    backgroundColor: colors.gradientOrange50,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.md,
  },
  ratingText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.primary,
  },
  vendorAddress: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  vendorDistance: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs / 2,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
});

