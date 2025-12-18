/**
 * Holiday Packages Screen - Customer Mobile App
 * Browse pet holiday packages
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
  Image,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import HolidayService, { HolidayPackage } from '../../services/HolidayService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface HolidayPackagesScreenProps {
  navigation?: any;
}

export default function HolidayPackagesScreen({
  navigation,
}: HolidayPackagesScreenProps) {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<HolidayPackage[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const holidayPackages = await HolidayService.getPackages();
      setPackages(holidayPackages);
    } catch (error) {
      console.error('Error loading holiday packages:', error);
      Alert.alert('Error', 'Failed to load holiday packages');
    } finally {
      setLoading(false);
    }
  };

  const filteredPackages = packages.filter((pkg) => {
    if (filter === 'all') return true;
    return pkg.packageType === filter;
  });

  const getPackageTypeIcon = (type: string) => {
    switch (type) {
      case 'beach':
        return 'beach-access';
      case 'mountain':
        return 'landscape';
      case 'city':
        return 'location-city';
      case 'wildlife':
        return 'pets';
      case 'adventure':
        return 'sports';
      case 'luxury':
        return 'star';
      default:
        return 'flight';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading holiday packages...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[Typography.h2, styles.headerTitle]}>Pet Holiday Packages</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              Plan the perfect getaway for your pet
            </Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { key: 'all', label: 'All' },
              { key: 'beach', label: 'Beach' },
              { key: 'mountain', label: 'Mountain' },
              { key: 'city', label: 'City' },
              { key: 'wildlife', label: 'Wildlife' },
              { key: 'adventure', label: 'Adventure' },
              { key: 'luxury', label: 'Luxury' },
            ].map((filterOption) => (
              <TouchableOpacity
                key={filterOption.key}
                style={[
                  styles.filterButton,
                  filter === filterOption.key && styles.filterButtonActive,
                ]}
                onPress={() => setFilter(filterOption.key)}
              >
                <Text
                  style={[
                    Typography.bodySmall,
                    filter === filterOption.key && styles.filterButtonTextActive,
                  ]}
                >
                  {filterOption.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Packages List */}
        {filteredPackages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="flight" size={64} color={BrandColors.neutral.gray300} />
            <Text style={[Typography.body, styles.emptyText]}>No packages available</Text>
          </View>
        ) : (
          <View style={styles.packagesList}>
            {filteredPackages.map((pkg) => (
              <TouchableOpacity
                key={pkg.packageId}
                style={styles.packageCard}
                onPress={() =>
                  navigation?.navigate('HolidayPackageDetail', { packageId: pkg.packageId })
                }
                activeOpacity={0.7}
              >
                {pkg.destinationImage && (
                  <Image
                    source={{ uri: pkg.destinationImage }}
                    style={styles.packageImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.packageContent}>
                  <View style={styles.packageHeader}>
                    <View style={styles.packageInfo}>
                      <Text style={[Typography.h4, styles.packageName]}>{pkg.packageName}</Text>
                      <View style={styles.packageMeta}>
                        <Icon
                          name={getPackageTypeIcon(pkg.packageType)}
                          size={16}
                          color={BrandColors.neutral.gray600}
                        />
                        <Text style={[Typography.bodyTiny, styles.packageDestination]}>
                          {pkg.destination}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.packagePriceContainer}>
                      <Text style={[Typography.h4, styles.packagePrice]}>
                        ₹{pkg.pricing.basePrice.toLocaleString()}
                      </Text>
                      <Text style={[Typography.bodyTiny, styles.packagePriceLabel]}>
                        Starting from
                      </Text>
                    </View>
                  </View>

                  <Text style={[Typography.bodySmall, styles.packageDescription]} numberOfLines={2}>
                    {pkg.description}
                  </Text>

                  <View style={styles.packageDetails}>
                    <View style={styles.packageDetail}>
                      <Icon name="calendar-today" size={16} color={BrandColors.neutral.gray600} />
                      <Text style={[Typography.bodyTiny, styles.packageDetailText]}>
                        {pkg.duration.days} days / {pkg.duration.nights} nights
                      </Text>
                    </View>
                    {pkg.isGroupTour && (
                      <View style={styles.packageDetail}>
                        <Icon name="people" size={16} color={BrandColors.neutral.gray600} />
                        <Text style={[Typography.bodyTiny, styles.packageDetailText]}>
                          Group Tour
                        </Text>
                      </View>
                    )}
                  </View>

                  {pkg.inclusions && pkg.inclusions.length > 0 && (
                    <View style={styles.inclusionsContainer}>
                      {pkg.inclusions.slice(0, 3).map((inclusion, index) => (
                        <View key={index} style={styles.inclusionBadge}>
                          <Icon name="check" size={12} color={BrandColors.semantic.success} />
                          <Text style={[Typography.bodyTiny, styles.inclusionText]}>
                            {inclusion}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
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
    paddingBottom: Spacing.xl,
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
  filtersContainer: {
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  filterButton: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.neutral.gray100,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    marginLeft: Spacing.base,
  },
  filterButtonActive: {
    backgroundColor: BrandColors.primary.orange,
    borderColor: BrandColors.primary.orange,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    minHeight: 400,
  },
  emptyText: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.base,
  },
  packagesList: {
    padding: Spacing.lg,
    gap: Spacing.base,
  },
  packageCard: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  packageImage: {
    width: '100%',
    height: 200,
    backgroundColor: BrandColors.neutral.gray200,
  },
  packageContent: {
    padding: Spacing.base,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  packageInfo: {
    flex: 1,
  },
  packageName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  packageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  packageDestination: {
    color: BrandColors.neutral.gray600,
  },
  packagePriceContainer: {
    alignItems: 'flex-end',
  },
  packagePrice: {
    color: BrandColors.primary.orange,
    fontWeight: '700',
  },
  packagePriceLabel: {
    color: BrandColors.neutral.gray600,
  },
  packageDescription: {
    color: BrandColors.neutral.gray700,
    marginBottom: Spacing.sm,
  },
  packageDetails: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginBottom: Spacing.sm,
  },
  packageDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  packageDetailText: {
    color: BrandColors.neutral.gray600,
  },
  inclusionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  inclusionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: BrandColors.semantic.success + '20',
    borderRadius: BorderRadius.sm,
  },
  inclusionText: {
    color: BrandColors.semantic.success,
    fontWeight: '600',
  },
});

