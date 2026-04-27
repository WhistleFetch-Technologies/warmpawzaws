/**
 * Service Detail Screen
 * Individual service details
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
  Image,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface ServiceDetailScreenProps {
  serviceId: string;
  vendorId?: string;
  phone: string;
  onBook: (serviceId: string, vendorId: string, serviceName?: string) => void;
  onBack?: () => void;
}

export function ServiceDetailScreen({
  serviceId,
  vendorId,
  phone,
  onBook,
  onBack,
}: ServiceDetailScreenProps) {
  const [service, setService] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServiceDetails();
  }, [serviceId, vendorId]);

  const loadServiceDetails = async () => {
    try {
      setLoading(true);
      const serviceData = await CustomerApi.getServiceDetails(serviceId);
      setService(serviceData);
      
      const resolvedVendorId = vendorId || serviceData.vendorId || serviceData.vendor_id;
      if (resolvedVendorId) {
        const vendorData = await CustomerApi.getVendorDetails(resolvedVendorId);
        setVendor(vendorData.vendor);
      }
    } catch (error) {
      console.error('Error loading service details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenShell>
    );
  }

  if (!service) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Service not found</Text>
          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {onBack && (
          <TouchableOpacity style={styles.headerBack} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}

        {service.photo && (
          <Image source={{ uri: service.photo }} style={styles.serviceImage} />
        )}

        <View style={styles.content}>
          <Text style={styles.serviceName}>{service.name || service.serviceName}</Text>
          
          {service.description && (
            <Text style={styles.description}>{service.description}</Text>
          )}

          {vendor && (
            <View style={styles.vendorSection}>
              <Text style={styles.sectionTitle}>Service Provider</Text>
              <View style={styles.vendorCard}>
                <Text style={styles.vendorName}>{vendor.name || vendor.businessName}</Text>
                {vendor.rating && (
                  <View style={styles.ratingContainer}>
                    <Text style={styles.ratingText}>⭐ {vendor.rating.toFixed(1)}</Text>
                  </View>
                )}
                {vendor.address && (
                  <Text style={styles.vendorAddress}>📍 {vendor.address}</Text>
                )}
              </View>
            </View>
          )}

          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Service Details</Text>
            
            {service.price && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Price:</Text>
                <Text style={styles.detailValue}>₹{service.price}</Text>
              </View>
            )}

            {service.duration && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Duration:</Text>
                <Text style={styles.detailValue}>{service.duration} minutes</Text>
              </View>
            )}

            {service.serviceStyle && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Service Type:</Text>
                <Text style={styles.detailValue}>
                  {service.serviceStyle.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {service.features && service.features.length > 0 && (
            <View style={styles.featuresSection}>
              <Text style={styles.sectionTitle}>Features</Text>
              {service.features.map((feature: string, index: number) => (
                <View key={index} style={styles.featureItem}>
                  <Text style={styles.featureBullet}>•</Text>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() =>
              onBook(
                serviceId,
                vendorId || service.vendorId || service.vendor_id,
                service.name || service.serviceName
              )
            }
          >
            <Text style={styles.bookButtonText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.fontSizes.md,
    color: colors.error,
    marginBottom: spacing.md,
  },
  headerBack: {
    padding: spacing.md,
  },
  backButton: {
    padding: spacing.md,
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  serviceImage: {
    width: '100%',
    height: 200,
    backgroundColor: colors.backgroundSecondary,
  },
  content: {
    padding: spacing.md,
  },
  serviceName: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  vendorSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  vendorCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  vendorName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  ratingContainer: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gradientOrange50,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  ratingText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.primary,
  },
  vendorAddress: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  detailsSection: {
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  featuresSection: {
    marginBottom: spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  featureBullet: {
    fontSize: typography.fontSizes.md,
    color: colors.primary,
    marginRight: spacing.sm,
  },
  featureText: {
    flex: 1,
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  bookButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  bookButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
});

