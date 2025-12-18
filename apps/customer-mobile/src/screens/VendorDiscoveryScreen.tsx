/**
 * Vendor Discovery Screen - Customer Mobile App
 * Lists vendors/staff based on problem selection
 * Matches web app VendorDiscoveryByProblem
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
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface Vendor {
  id: string;
  vendorId?: string;
  vendorName?: string;
  businessName?: string;
  fullName?: string;
  type: 'center' | 'staff' | 'individual';
  rating?: number;
  reviews?: number;
  distance?: number;
  location?: {
    address?: string;
    lat?: number;
    lng?: number;
  };
  specializations?: string[];
  consultationFee?: number;
  serviceStyle?: 'at_home' | 'at_center' | 'both';
}

interface VendorDiscoveryScreenProps {
  route?: {
    params?: {
      roleId?: string;
      roleName?: string;
      problemId?: string;
      problem?: any;
    };
  };
  navigation?: any;
}

export default function VendorDiscoveryScreen({
  route,
  navigation,
}: VendorDiscoveryScreenProps) {
  const { user } = useAuth();
  const roleId = route?.params?.roleId || 'veterinarian';
  const roleName = route?.params?.roleName || 'Service Provider';
  const problemId = route?.params?.problemId || '';
  const problem = route?.params?.problem;

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'staff' | 'center'>('all');

  useEffect(() => {
    loadVendors();
  }, [problemId, roleId]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      
      if (!problemId) {
        Alert.alert('Error', 'Problem ID is required');
        return;
      }

      const params = new URLSearchParams({
        problemGridId: problemId,
        roleId: roleId,
        sortBy: 'rating',
        feeMin: '0',
        feeMax: '999999',
      });

      // Add location if available (from user profile or GPS)
      // TODO: Get user location

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/universal-problem-discovery?${params}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // API returns 'specialists' array, map to vendor format
        const specialists = data.specialists || data.results || [];
        
        // Map specialists to vendor format with service style information
        const mappedVendors = specialists.map((specialist: any) => ({
          id: specialist.id || specialist.staffId,
          vendorId: specialist.clinicId || specialist.vendorId || specialist.id,
          vendorName: specialist.clinicName || specialist.vendorName || specialist.fullName || specialist.name,
          businessName: specialist.clinicName || specialist.vendorName || specialist.businessName,
          fullName: specialist.fullName || specialist.name,
          type: specialist.staffId ? 'staff' : 'center',
          rating: specialist.rating || 0,
          reviews: specialist.reviewCount || specialist.totalReviews || 0,
          distance: specialist.distance,
          location: {
            address: specialist.clinicAddress || specialist.location || specialist.vendorAddress,
            lat: specialist.latitude,
            lng: specialist.longitude,
          },
          specializations: specialist.specializations || [],
          consultationFee: specialist.consultationFee || 0,
          // Extract service style from services array (first service's style)
          serviceStyle: specialist.services && specialist.services.length > 0 
            ? specialist.services[0].serviceStyle 
            : undefined,
          services: specialist.services || [], // Pass services through for service selection
        }));
        
        setVendors(mappedVendors);
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || 'Failed to load service providers');
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
      Alert.alert('Error', 'Cannot connect to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadVendors();
  };

  const filteredVendors = vendors.filter((vendor) => {
    if (filterType === 'all') return true;
    if (filterType === 'center') return vendor.type === 'center';
    if (filterType === 'staff') return vendor.type === 'staff' || vendor.type === 'individual';
    return true;
  });

  const handleVendorSelect = (vendor: Vendor) => {
    // Navigate to service selection with vendor info and services
    navigation?.navigate('ServiceSelection', {
      vendorId: vendor.vendorId || vendor.id,
      vendorName: vendor.vendorName || vendor.businessName || vendor.fullName,
      roleId,
      problemId,
      services: vendor.services || [], // Pass pre-loaded services if available
    });
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Finding {roleName}...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BrandColors.primary.orange}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[Typography.h2, styles.headerTitle]}>
              {problem?.displayName || problem?.name || 'Service Providers'}
            </Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              Select a {roleName.toLowerCase()}
            </Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filters}>
          {(['all', 'staff', 'center'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                filterType === filter && styles.filterButtonActive,
              ]}
              onPress={() => setFilterType(filter)}
            >
              <Text
                style={[
                  Typography.bodySmall,
                  filterType === filter && styles.filterButtonTextActive,
                ]}
              >
                {filter === 'all' ? 'All' : filter === 'staff' ? 'Individual' : 'Centers'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Vendor List */}
        {filteredVendors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="search-off" size={48} color={BrandColors.neutral.gray300} />
            <Text style={[Typography.body, styles.emptyText]}>
              No {roleName.toLowerCase()}s found
            </Text>
            <Text style={[Typography.bodySmall, styles.emptySubtext]}>
              Try adjusting your filters
            </Text>
          </View>
        ) : (
          <View style={styles.vendorList}>
            {filteredVendors.map((vendor) => (
              <TouchableOpacity
                key={vendor.id}
                style={styles.vendorCard}
                onPress={() => handleVendorSelect(vendor)}
                activeOpacity={0.7}
              >
                <View style={styles.vendorHeader}>
                  <View style={styles.vendorInfo}>
                    <Text style={[Typography.h4, styles.vendorName]} numberOfLines={1}>
                      {vendor.vendorName || vendor.businessName || vendor.fullName}
                    </Text>
                    {vendor.rating && (
                      <View style={styles.ratingRow}>
                        <Icon name="star" size={16} color={BrandColors.semantic.warning} />
                        <Text style={[Typography.bodySmall, styles.rating]}>
                          {vendor.rating.toFixed(1)}
                        </Text>
                        {vendor.reviews && (
                          <Text style={[Typography.bodyTiny, styles.reviews]}>
                            ({vendor.reviews} reviews)
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  <Icon name="chevron-right" size={24} color={BrandColors.neutral.gray400} />
                </View>

                {vendor.location?.address && (
                  <View style={styles.locationRow}>
                    <Icon name="location-on" size={16} color={BrandColors.neutral.gray500} />
                    <Text style={[Typography.bodyTiny, styles.location]} numberOfLines={1}>
                      {vendor.location.address}
                    </Text>
                  </View>
                )}

                {vendor.distance && (
                  <View style={styles.distanceRow}>
                    <Icon name="directions-walk" size={16} color={BrandColors.primary.orange} />
                    <Text style={[Typography.bodyTiny, styles.distance]}>
                      {vendor.distance.toFixed(1)} km away
                    </Text>
                  </View>
                )}

                {vendor.consultationFee && (
                  <View style={styles.feeRow}>
                    <Text style={[Typography.bodySmall, styles.fee]}>
                      ₹{vendor.consultationFee} consultation fee
                    </Text>
                  </View>
                )}

                {vendor.serviceStyle && (
                  <View style={styles.serviceStyleRow}>
                    {vendor.serviceStyle === 'at_home' && (
                      <View style={styles.serviceStyleBadge}>
                        <Icon name="home" size={14} color={BrandColors.primary.orange} />
                        <Text style={[Typography.bodyTiny, styles.serviceStyleText]}>
                          At Home
                        </Text>
                      </View>
                    )}
                    {vendor.serviceStyle === 'at_center' && (
                      <View style={styles.serviceStyleBadge}>
                        <Icon name="business" size={14} color={BrandColors.primary.orange} />
                        <Text style={[Typography.bodyTiny, styles.serviceStyleText]}>
                          At Center
                        </Text>
                      </View>
                    )}
                    {vendor.serviceStyle === 'both' && (
                      <View style={styles.serviceStyleBadge}>
                        <Icon name="swap-horiz" size={14} color={BrandColors.primary.orange} />
                        <Text style={[Typography.bodyTiny, styles.serviceStyleText]}>
                          Both
                        </Text>
                      </View>
                    )}
                  </View>
                )}
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
  filters: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    gap: Spacing.sm,
  },
  filterButton: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.neutral.gray100,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  filterButtonActive: {
    backgroundColor: BrandColors.primary.orange,
    borderColor: BrandColors.primary.orange,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  vendorList: {
    padding: Spacing.lg,
    gap: Spacing.base,
  },
  vendorCard: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  vendorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  rating: {
    color: BrandColors.neutral.gray700,
    fontWeight: '600',
  },
  reviews: {
    color: BrandColors.neutral.gray500,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  location: {
    color: BrandColors.neutral.gray600,
    flex: 1,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  distance: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  feeRow: {
    marginTop: Spacing.xs,
  },
  fee: {
    color: BrandColors.neutral.gray700,
    fontWeight: '600',
  },
  serviceStyleRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  serviceStyleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: BrandColors.primary.orange + '20',
    borderRadius: BorderRadius.sm,
  },
  serviceStyleText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    minHeight: 300,
  },
  emptyText: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.base,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    color: BrandColors.neutral.gray500,
  },
});

