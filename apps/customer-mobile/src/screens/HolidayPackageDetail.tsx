/**
 * Holiday Package Detail Screen - Customer Mobile App
 * Complete package information and booking
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
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, getPublicAnonKey } from '../../config/api';

interface HolidayPackage {
  id: string;
  packageName: string;
  destination: string;
  tourType: 'group' | 'private' | 'family';
  duration: number; // days
  price: number;
  inclusions: string[];
  exclusions: string[];
  itinerary: Array<{ day: number; activities: string[] }>;
  photos: string[];
  amenities: string[];
  applicableDates: Array<{ start: string; end: string }>;
  maxPets: number;
  maxOwners: number;
  cancellationPolicy: string;
  rating: number;
  reviews: number;
}

export default function HolidayPackageDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { packageId } = route.params as { packageId: string };

  const [packageData, setPackageData] = useState<HolidayPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    loadPackageDetails();
  }, [packageId]);

  const loadPackageDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/holiday-packages/${packageId}`,
        {
          headers: {
            'Authorization': `Bearer ${getPublicAnonKey()}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPackageData(data.package);
      }
    } catch (error) {
      console.error('Error loading package:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleBook = () => {
    if (!selectedDate) {
      // Show date picker or alert
      return;
    }
    navigation.navigate('HolidayBooking' as never, {
      packageId,
      package: packageData,
      selectedDate,
    } as never);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={BrandColors.text} />
          </TouchableOpacity>
          <Text style={[Typography.h2, styles.headerTitle]}>Package Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      </View>
    );
  }

  if (!packageData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={BrandColors.text} />
          </TouchableOpacity>
          <Text style={[Typography.h2, styles.headerTitle]}>Package Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[Typography.h3, styles.emptyText]}>Package not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={BrandColors.text} />
        </TouchableOpacity>
        <Text style={[Typography.h2, styles.headerTitle]}>Package Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadPackageDetails}
            colors={[BrandColors.primary]}
          />
        }
      >
        {/* Photo Gallery */}
        {packageData.photos && packageData.photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoGallery}>
            {packageData.photos.map((photo, index) => (
              <Image
                key={index}
                source={{ uri: photo }}
                style={styles.photo}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        )}

        {/* Package Info */}
        <View style={styles.section}>
          <Text style={[Typography.h1, styles.title]}>{packageData.packageName}</Text>
          <View style={styles.metaRow}>
            <Icon name="place" size={16} color={BrandColors.textSecondary} />
            <Text style={[Typography.body, styles.metaText]}>{packageData.destination}</Text>
          </View>
          <View style={styles.metaRow}>
            <Icon name="schedule" size={16} color={BrandColors.textSecondary} />
            <Text style={[Typography.body, styles.metaText]}>
              {packageData.duration} {packageData.duration === 1 ? 'Day' : 'Days'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Icon name="star" size={16} color="#FFD700" />
            <Text style={[Typography.body, styles.metaText]}>
              {packageData.rating?.toFixed(1) || 'N/A'} ({packageData.reviews || 0} reviews)
            </Text>
          </View>
        </View>

        {/* Price */}
        <View style={styles.priceSection}>
          <Text style={[Typography.h2, styles.price]}>₹{packageData.price.toLocaleString('en-IN')}</Text>
          <Text style={[Typography.bodySmall, styles.priceNote]}>per package</Text>
        </View>

        {/* Tour Type */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Tour Type</Text>
          <View style={styles.tourTypeBadge}>
            <Text style={[Typography.body, styles.tourTypeText]}>
              {packageData.tourType.charAt(0).toUpperCase() + packageData.tourType.slice(1)} Tour
            </Text>
          </View>
        </View>

        {/* Itinerary */}
        {packageData.itinerary && packageData.itinerary.length > 0 && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Itinerary</Text>
            {packageData.itinerary.map((day, index) => (
              <View key={index} style={styles.itineraryDay}>
                <Text style={[Typography.body, styles.dayTitle]}>Day {day.day}</Text>
                {day.activities.map((activity, actIndex) => (
                  <View key={actIndex} style={styles.activityItem}>
                    <Icon name="check-circle" size={16} color={BrandColors.primary} />
                    <Text style={[Typography.bodySmall, styles.activityText]}>{activity}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Inclusions */}
        {packageData.inclusions && packageData.inclusions.length > 0 && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Inclusions</Text>
            {packageData.inclusions.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <Icon name="check" size={20} color="#4CAF50" />
                <Text style={[Typography.body, styles.listText]}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Exclusions */}
        {packageData.exclusions && packageData.exclusions.length > 0 && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Exclusions</Text>
            {packageData.exclusions.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <Icon name="close" size={20} color="#F44336" />
                <Text style={[Typography.body, styles.listText]}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Amenities */}
        {packageData.amenities && packageData.amenities.length > 0 && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Amenities</Text>
            <View style={styles.amenitiesGrid}>
              {packageData.amenities.map((amenity, index) => (
                <View key={index} style={styles.amenityItem}>
                  <Text style={[Typography.bodySmall, styles.amenityText]}>{amenity}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Cancellation Policy */}
        {packageData.cancellationPolicy && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Cancellation Policy</Text>
            <Text style={[Typography.body, styles.policyText]}>{packageData.cancellationPolicy}</Text>
          </View>
        )}
      </ScrollView>

      {/* Booking Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.bookButton, !selectedDate && styles.bookButtonDisabled]}
          onPress={handleBook}
          disabled={!selectedDate}
        >
          <Text style={[Typography.button, styles.bookButtonText]}>
            Book Package - ₹{packageData.price.toLocaleString('en-IN')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: BrandColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: BrandColors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    color: BrandColors.text,
  },
  content: {
    flex: 1,
  },
  photoGallery: {
    height: 200,
  },
  photo: {
    width: 300,
    height: 200,
    marginRight: Spacing.sm,
  },
  section: {
    padding: Spacing.md,
    backgroundColor: BrandColors.surface,
    marginBottom: Spacing.sm,
  },
  title: {
    color: BrandColors.text,
    marginBottom: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  metaText: {
    marginLeft: Spacing.xs,
    color: BrandColors.textSecondary,
  },
  priceSection: {
    padding: Spacing.md,
    backgroundColor: BrandColors.primary + '10',
    alignItems: 'center',
  },
  price: {
    color: BrandColors.primary,
  },
  priceNote: {
    color: BrandColors.textSecondary,
    marginTop: 4,
  },
  sectionTitle: {
    color: BrandColors.text,
    marginBottom: Spacing.sm,
  },
  tourTypeBadge: {
    backgroundColor: BrandColors.primary + '20',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignSelf: 'flex-start',
  },
  tourTypeText: {
    color: BrandColors.primary,
    fontWeight: '600',
  },
  itineraryDay: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: BrandColors.background,
    borderRadius: BorderRadius.md,
  },
  dayTitle: {
    fontWeight: '600',
    color: BrandColors.text,
    marginBottom: Spacing.sm,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  activityText: {
    marginLeft: Spacing.sm,
    color: BrandColors.text,
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  listText: {
    marginLeft: Spacing.sm,
    color: BrandColors.text,
    flex: 1,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
  },
  amenityItem: {
    backgroundColor: BrandColors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  amenityText: {
    color: BrandColors.text,
  },
  policyText: {
    color: BrandColors.text,
    lineHeight: 20,
  },
  footer: {
    padding: Spacing.md,
    backgroundColor: BrandColors.surface,
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
  },
  bookButton: {
    backgroundColor: BrandColors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: BrandColors.border,
  },
  bookButtonText: {
    color: '#FFFFFF',
  },
});

