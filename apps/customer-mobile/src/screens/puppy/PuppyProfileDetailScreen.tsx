/**
 * Puppy Profile Detail Screen - Customer Mobile App
 * View detailed puppy profile with lineage, vaccination, nature
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
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
    pedigree?: string;
  };
  vaccinationStatus: 'complete' | 'partial' | 'pending';
  vaccinations?: Array<{
    name: string;
    date: string;
    nextDue?: string;
  }>;
  nature?: string;
  description?: string;
  healthRecords?: string[];
  certifications?: string[];
}

export default function PuppyProfileDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { profileId } = route.params as { profileId: string };

  const [profile, setProfile] = useState<PuppyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    loadProfileDetails();
  }, [profileId]);

  const loadProfileDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/puppy-profile/${profileId}`, {
        headers: {
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
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

  const handleContactBreeder = () => {
    Alert.alert('Contact Breeder', `Would you like to contact ${profile?.breederName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Call',
        onPress: () => {
          // Handle call
        },
      },
      {
        text: 'Message',
        onPress: () => {
          navigation.navigate('Chat' as never, {
            chatId: `breeder_${profile?.breederId}`,
            recipientId: profile?.breederId || '',
          } as never);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={64} color={BrandColors.text.secondary} />
        <Text style={styles.errorText}>Puppy profile not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Image Gallery */}
      {profile.images && profile.images.length > 0 && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: profile.images[selectedImageIndex] }}
            style={styles.mainImage}
            resizeMode="cover"
          />
          {profile.images.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailContainer}>
              {profile.images.map((image, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedImageIndex(index)}
                  style={[
                    styles.thumbnail,
                    selectedImageIndex === index && styles.thumbnailSelected,
                  ]}
                >
                  <Image source={{ uri: image }} style={styles.thumbnailImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      <View style={styles.content}>
        {/* Basic Info */}
        <View style={styles.header}>
          <Text style={styles.puppyName}>{profile.name}</Text>
          <Text style={styles.puppyBreed}>{profile.breed}</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>₹{profile.price}</Text>
          </View>
        </View>

        {/* Quick Details */}
        <View style={styles.quickDetails}>
          <View style={styles.detailItem}>
            <Icon name="cake" size={20} color={BrandColors.primary.orange} />
            <Text style={styles.detailText}>{profile.age} months old</Text>
          </View>
          <View style={styles.detailItem}>
            <Icon
              name={profile.gender === 'male' ? 'male' : 'female'}
              size={20}
              color={BrandColors.primary.orange}
            />
            <Text style={styles.detailText}>{profile.gender === 'male' ? 'Male' : 'Female'}</Text>
          </View>
          <View style={styles.detailItem}>
            <Icon name="location-on" size={20} color={BrandColors.primary.orange} />
            <Text style={styles.detailText}>{profile.location}</Text>
          </View>
        </View>

        {/* Vaccination Status */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="vaccines" size={24} color={BrandColors.primary.orange} />
            <Text style={styles.sectionTitle}>Vaccination Status</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  profile.vaccinationStatus === 'complete'
                    ? '#E8F5E9'
                    : profile.vaccinationStatus === 'partial'
                    ? '#FFF3E0'
                    : '#FFEBEE',
              },
            ]}
          >
            <Icon
              name={
                profile.vaccinationStatus === 'complete'
                  ? 'check-circle'
                  : profile.vaccinationStatus === 'partial'
                  ? 'warning'
                  : 'error'
              }
              size={20}
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
                styles.statusText,
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
              {profile.vaccinationStatus === 'complete'
                ? 'Complete'
                : profile.vaccinationStatus === 'partial'
                ? 'Partial'
                : 'Pending'}
            </Text>
          </View>
          {profile.vaccinations && profile.vaccinations.length > 0 && (
            <View style={styles.vaccinationList}>
              {profile.vaccinations.map((vaccination, index) => (
                <View key={index} style={styles.vaccinationItem}>
                  <Text style={styles.vaccinationName}>{vaccination.name}</Text>
                  <Text style={styles.vaccinationDate}>
                    Given: {new Date(vaccination.date).toLocaleDateString()}
                  </Text>
                  {vaccination.nextDue && (
                    <Text style={styles.vaccinationNext}>
                      Next due: {new Date(vaccination.nextDue).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Lineage */}
        {profile.lineage && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="family-tree" size={24} color={BrandColors.primary.orange} />
              <Text style={styles.sectionTitle}>Lineage</Text>
            </View>
            {profile.lineage.sire && (
              <View style={styles.lineageItem}>
                <Text style={styles.lineageLabel}>Sire (Father):</Text>
                <Text style={styles.lineageValue}>{profile.lineage.sire}</Text>
              </View>
            )}
            {profile.lineage.dam && (
              <View style={styles.lineageItem}>
                <Text style={styles.lineageLabel}>Dam (Mother):</Text>
                <Text style={styles.lineageValue}>{profile.lineage.dam}</Text>
              </View>
            )}
            {profile.lineage.pedigree && (
              <View style={styles.lineageItem}>
                <Text style={styles.lineageLabel}>Pedigree:</Text>
                <Text style={styles.lineageValue}>{profile.lineage.pedigree}</Text>
              </View>
            )}
          </View>
        )}

        {/* Nature & Description */}
        {profile.nature && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="favorite" size={24} color={BrandColors.primary.orange} />
              <Text style={styles.sectionTitle}>Nature & Temperament</Text>
            </View>
            <Text style={styles.sectionContent}>{profile.nature}</Text>
          </View>
        )}

        {profile.description && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="description" size={24} color={BrandColors.primary.orange} />
              <Text style={styles.sectionTitle}>Description</Text>
            </View>
            <Text style={styles.sectionContent}>{profile.description}</Text>
          </View>
        )}

        {/* Health Records */}
        {profile.healthRecords && profile.healthRecords.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="medical-services" size={24} color={BrandColors.primary.orange} />
              <Text style={styles.sectionTitle}>Health Records</Text>
            </View>
            {profile.healthRecords.map((record, index) => (
              <View key={index} style={styles.recordItem}>
                <Icon name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.recordText}>{record}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Certifications */}
        {profile.certifications && profile.certifications.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="verified" size={24} color={BrandColors.primary.orange} />
              <Text style={styles.sectionTitle}>Certifications</Text>
            </View>
            {profile.certifications.map((cert, index) => (
              <View key={index} style={styles.certItem}>
                <Icon name="verified" size={16} color={BrandColors.primary.orange} />
                <Text style={styles.certText}>{cert}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Breeder Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="person" size={24} color={BrandColors.primary.orange} />
            <Text style={styles.sectionTitle}>Breeder</Text>
          </View>
          <Text style={styles.breederName}>{profile.breederName}</Text>
          <Text style={styles.breederLocation}>{profile.location}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={handleContactBreeder}
          >
            <Icon name="phone" size={20} color="#FFFFFF" />
            <Text style={styles.contactButtonText}>Contact Breeder</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.inquireButton}
            onPress={() => {
              // Navigate to inquiry/booking
            }}
          >
            <Text style={styles.inquireButtonText}>Make Inquiry</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
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
  errorText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.secondary,
    marginTop: Spacing.md,
  },
  imageContainer: {
    marginBottom: Spacing.md,
  },
  mainImage: {
    width: '100%',
    height: 300,
  },
  thumbnailContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailSelected: {
    borderColor: BrandColors.primary.orange,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.sm,
  },
  content: {
    padding: Spacing.md,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  puppyName: {
    ...Typography.headingLarge,
    color: BrandColors.text.primary,
    marginBottom: Spacing.xs,
  },
  puppyBreed: {
    ...Typography.headingSmall,
    color: BrandColors.text.secondary,
    marginBottom: Spacing.md,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    ...Typography.headingLarge,
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  quickDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.lg,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.md,
    marginBottom: Spacing.sm,
  },
  detailText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    marginLeft: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginLeft: Spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  statusText: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  vaccinationList: {
    marginTop: Spacing.sm,
  },
  vaccinationItem: {
    padding: Spacing.sm,
    backgroundColor: '#F5F5F5',
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  vaccinationName: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  vaccinationDate: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
  },
  vaccinationNext: {
    ...Typography.bodySmall,
    color: BrandColors.primary.orange,
    marginTop: Spacing.xs,
  },
  lineageItem: {
    marginBottom: Spacing.sm,
  },
  lineageLabel: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
    marginBottom: Spacing.xs,
  },
  lineageValue: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
  },
  sectionContent: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    lineHeight: 24,
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  recordText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    marginLeft: Spacing.sm,
  },
  certItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  certText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    marginLeft: Spacing.sm,
  },
  breederName: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  breederLocation: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
  },
  actionContainer: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.primary.orange,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  contactButtonText: {
    ...Typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  inquireButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: BrandColors.primary.orange,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  inquireButtonText: {
    ...Typography.bodyMedium,
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
});
