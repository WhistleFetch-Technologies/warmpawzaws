/**
 * Service Card Component
 * Matches web app service cards with service-specific colors
 */

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { BrandColors, Typography, BorderRadius, Spacing, getServiceColor, getServiceColorWithOpacity } from '../theme';

interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    image: string;
    price: number;
    serviceType: string;
    rating?: number;
    vendorName?: string;
  };
  onPress: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, onPress }) => {
  const serviceColor = getServiceColor(service.serviceType);
  const serviceBgColor = getServiceColorWithOpacity(service.serviceType, 0.1);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          borderTopColor: serviceColor,
          borderTopWidth: 4,
          borderRadius: BorderRadius.lg,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image source={{ uri: service.image }} style={styles.image} />
      <View style={styles.content}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: serviceBgColor,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              Typography.bodySmall,
              { color: serviceColor },
            ]}
          >
            {service.serviceType}
          </Text>
        </View>
        <Text
          style={[Typography.h4, styles.serviceName]}
          numberOfLines={2}
        >
          {service.name}
        </Text>
        {service.vendorName && (
          <Text
            style={[Typography.bodySmall, styles.vendorName]}
            numberOfLines={1}
          >
            {service.vendorName}
          </Text>
        )}
        {service.rating && (
          <View style={styles.ratingContainer}>
            <Text style={[Typography.bodySmall, styles.rating]}>
              ⭐ {service.rating}
            </Text>
          </View>
        )}
        <Text
          style={[
            Typography.body,
            styles.price,
            { color: BrandColors.primary.orange },
          ]}
        >
          ₹{service.price}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: Spacing.base,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 120,
    backgroundColor: BrandColors.neutral.gray100,
  },
  content: {
    padding: Spacing.base,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
  },
  badgeText: {
    fontWeight: '600',
  },
  serviceName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  vendorName: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.xs,
  },
  ratingContainer: {
    marginBottom: Spacing.xs,
  },
  rating: {
    color: BrandColors.neutral.gray700,
  },
  price: {
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
});

