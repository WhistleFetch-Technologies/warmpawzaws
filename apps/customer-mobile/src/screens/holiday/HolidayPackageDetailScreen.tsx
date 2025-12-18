/**
 * Holiday Package Detail Screen - Customer Mobile App
 * View package details and itinerary
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

interface HolidayPackageDetailScreenProps {
  route?: {
    params?: {
      packageId: string;
    };
  };
  navigation?: any;
}

export default function HolidayPackageDetailScreen({
  route,
  navigation,
}: HolidayPackageDetailScreenProps) {
  const packageId = route?.params?.packageId || '';

  const [loading, setLoading] = useState(true);
  const [packageData, setPackageData] = useState<HolidayPackage | null>(null);

  useEffect(() => {
    loadPackageDetails();
  }, [packageId]);

  const loadPackageDetails = async () => {
    try {
      setLoading(true);
      const pkg = await HolidayService.getPackageDetails(packageId);
      if (pkg) {
        setPackageData(pkg);
      } else {
        Alert.alert('Error', 'Package not found');
        navigation?.goBack();
      }
    } catch (error) {
      console.error('Error loading package details:', error);
      Alert.alert('Error', 'Failed to load package details');
    } finally {
      setLoading(false);
    }
  };

  const handleBook = () => {
    if (!packageData) return;
    navigation?.navigate('HolidayBooking', { packageId: packageData.packageId });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading package details...
        </Text>
      </View>
    );
  }

  if (!packageData) {
    return null;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Hero Image */}
        {packageData.destinationImage && (
          <Image
            source={{ uri: packageData.destinationImage }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        )}

        {/* Package Info */}
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerInfo}>
                <Text style={[Typography.h2, styles.packageName]}>{packageData.packageName}</Text>
                <View style={styles.metaRow}>
                  <Icon name="place" size={16} color={BrandColors.neutral.gray600} />
                  <Text style={[Typography.bodySmall, styles.destination]}>
                    {packageData.destination}
                  </Text>
                </View>
              </View>
              <View style={styles.priceContainer}>
                <Text style={[Typography.h3, styles.price]}>
                  ₹{packageData.pricing.basePrice.toLocaleString()}
                </Text>
                <Text style={[Typography.bodyTiny, styles.priceLabel]}>Starting from</Text>
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={[Typography.body, styles.description]}>{packageData.description}</Text>
          </View>

          {/* Duration & Type */}
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Icon name="calendar-today" size={20} color={BrandColors.primary.orange} />
              <Text style={[Typography.bodySmall, styles.detailText]}>
                {packageData.duration.days} Days / {packageData.duration.nights} Nights
              </Text>
            </View>
            {packageData.isGroupTour && (
              <View style={styles.detailItem}>
                <Icon name="people" size={20} color={BrandColors.primary.orange} />
                <Text style={[Typography.bodySmall, styles.detailText]}>Group Tour</Text>
              </View>
            )}
          </View>

          {/* Itinerary */}
          {packageData.itinerary && packageData.itinerary.length > 0 && (
            <View style={styles.section}>
              <Text style={[Typography.h3, styles.sectionTitle]}>Itinerary</Text>
              {packageData.itinerary.map((day, index) => (
                <View key={index} style={styles.itineraryDay}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayNumber}>
                      <Text style={[Typography.body, styles.dayNumberText]}>Day {day.day}</Text>
                    </View>
                    <Text style={[Typography.h4, styles.dayTitle]}>{day.title}</Text>
                  </View>
                  <Text style={[Typography.bodySmall, styles.dayDescription]}>
                    {day.description}
                  </Text>
                  {day.activities && day.activities.length > 0 && (
                    <View style={styles.activitiesList}>
                      {day.activities.map((activity, actIndex) => (
                        <View key={actIndex} style={styles.activityItem}>
                          <Icon name="check-circle" size={14} color={BrandColors.semantic.success} />
                          <Text style={[Typography.bodyTiny, styles.activityText]}>
                            {activity}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Inclusions */}
          {packageData.inclusions && packageData.inclusions.length > 0 && (
            <View style={styles.section}>
              <Text style={[Typography.h3, styles.sectionTitle]}>Inclusions</Text>
              <View style={styles.inclusionsList}>
                {packageData.inclusions.map((inclusion, index) => (
                  <View key={index} style={styles.inclusionItem}>
                    <Icon name="check" size={16} color={BrandColors.semantic.success} />
                    <Text style={[Typography.bodySmall, styles.inclusionText]}>{inclusion}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Exclusions */}
          {packageData.exclusions && packageData.exclusions.length > 0 && (
            <View style={styles.section}>
              <Text style={[Typography.h3, styles.sectionTitle]}>Exclusions</Text>
              <View style={styles.exclusionsList}>
                {packageData.exclusions.map((exclusion, index) => (
                  <View key={index} style={styles.exclusionItem}>
                    <Icon name="cancel" size={16} color={BrandColors.semantic.error} />
                    <Text style={[Typography.bodySmall, styles.exclusionText]}>{exclusion}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Requirements */}
          {packageData.requirements && (
            <View style={styles.section}>
              <Text style={[Typography.h3, styles.sectionTitle]}>Requirements</Text>
              {packageData.requirements.petRequirements &&
                packageData.requirements.petRequirements.length > 0 && (
                  <View style={styles.requirementsList}>
                    <Text style={[Typography.bodySmall, styles.requirementsTitle]}>
                      Pet Requirements:
                    </Text>
                    {packageData.requirements.petRequirements.map((req, index) => (
                      <Text key={index} style={[Typography.bodyTiny, styles.requirementText]}>
                        • {req}
                      </Text>
                    ))}
                  </View>
                )}
            </View>
          )}

          {/* Policies */}
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Policies</Text>
            {packageData.cancellationPolicy && (
              <View style={styles.policyCard}>
                <Text style={[Typography.bodySmall, styles.policyTitle]}>
                  Cancellation Policy
                </Text>
                <Text style={[Typography.bodyTiny, styles.policyText]}>
                  {packageData.cancellationPolicy}
                </Text>
              </View>
            )}
            {packageData.refundPolicy && (
              <View style={styles.policyCard}>
                <Text style={[Typography.bodySmall, styles.policyTitle]}>Refund Policy</Text>
                <Text style={[Typography.bodyTiny, styles.policyText]}>
                  {packageData.refundPolicy}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Book Button */}
      <View style={styles.footer}>
        <View style={styles.priceFooter}>
          <Text style={[Typography.body, styles.priceFooterLabel]}>Starting from</Text>
          <Text style={[Typography.h3, styles.priceFooterValue]}>
            ₹{packageData.pricing.basePrice.toLocaleString()}
          </Text>
        </View>
        <BrandedButton
          title="Book Now"
          onPress={handleBook}
          variant="primary"
          fullWidth
        />
      </View>
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
    paddingBottom: Spacing.xl + 100,
  },
  heroImage: {
    width: '100%',
    height: 250,
    backgroundColor: BrandColors.neutral.gray200,
  },
  content: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.base,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.base,
  },
  headerInfo: {
    flex: 1,
  },
  packageName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  destination: {
    color: BrandColors.neutral.gray600,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    color: BrandColors.primary.orange,
    fontWeight: '700',
  },
  priceLabel: {
    color: BrandColors.neutral.gray600,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  description: {
    color: BrandColors.neutral.gray700,
    lineHeight: 22,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginBottom: Spacing.lg,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    backgroundColor: BrandColors.primary.orange + '10',
    borderRadius: BorderRadius.sm,
  },
  detailText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  itineraryDay: {
    marginBottom: Spacing.base,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    marginBottom: Spacing.sm,
  },
  dayNumber: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: BrandColors.primary.orange,
    borderRadius: BorderRadius.sm,
  },
  dayNumberText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dayTitle: {
    color: BrandColors.neutral.gray900,
    flex: 1,
  },
  dayDescription: {
    color: BrandColors.neutral.gray700,
    marginBottom: Spacing.sm,
  },
  activitiesList: {
    gap: Spacing.xs,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  activityText: {
    color: BrandColors.neutral.gray600,
    flex: 1,
  },
  inclusionsList: {
    gap: Spacing.sm,
  },
  inclusionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inclusionText: {
    color: BrandColors.neutral.gray700,
    flex: 1,
  },
  exclusionsList: {
    gap: Spacing.sm,
  },
  exclusionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  exclusionText: {
    color: BrandColors.neutral.gray600,
    flex: 1,
  },
  requirementsList: {
    marginTop: Spacing.sm,
  },
  requirementsTitle: {
    color: BrandColors.neutral.gray700,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  requirementText: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.xs,
  },
  policyCard: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.base,
  },
  policyTitle: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  policyText: {
    color: BrandColors.neutral.gray700,
    lineHeight: 18,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
    backgroundColor: '#FFFFFF',
    gap: Spacing.base,
  },
  priceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceFooterLabel: {
    color: BrandColors.neutral.gray700,
  },
  priceFooterValue: {
    color: BrandColors.primary.orange,
    fontWeight: '700',
  },
});

