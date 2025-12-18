/**
 * Home Screen - Customer Mobile App
 * Main landing page with service categories
 * Matches web app CustomerHomeWrapper
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { projectId, publicAnonKey } from '../../config/api';

interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  roleId: string;
  description: string;
}

const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'vet',
    name: 'Veterinarian',
    icon: 'medical-services',
    color: BrandColors.service.vet,
    roleId: 'veterinarian',
    description: 'Vet consultations, clinics, home visits',
  },
  {
    id: 'grooming',
    name: 'Grooming',
    icon: 'content-cut',
    color: BrandColors.service.grooming,
    roleId: 'pet_groomer',
    description: 'At home & center grooming',
  },
  {
    id: 'training',
    name: 'Training',
    icon: 'school',
    color: BrandColors.service.training,
    roleId: 'pet_trainer',
    description: 'Behavior & training sessions',
  },
  {
    id: 'walking',
    name: 'Pet Walking',
    icon: 'directions-walk',
    color: BrandColors.service.walking,
    roleId: 'pet_walker',
    description: 'Daily walks & exercise',
  },
  {
    id: 'boarding',
    name: 'Boarding',
    icon: 'hotel',
    color: BrandColors.service.boarding,
    roleId: 'boarding_center',
    description: 'Pet boarding & daycare',
  },
  {
    id: 'resort',
    name: 'Pet Resort',
    icon: 'pool',
    color: BrandColors.service.resort,
    roleId: 'pet_resort',
    description: 'Luxury pet stays',
  },
  {
    id: 'cafe',
    name: 'Pet Cafe',
    icon: 'restaurant',
    color: BrandColors.service.cafe,
    roleId: 'pet_cafe',
    description: 'Pet-friendly cafes',
  },
  {
    id: 'insurance',
    name: 'Pet Insurance',
    icon: 'security',
    color: BrandColors.service.insurance,
    roleId: 'pet_insurance',
    description: 'Insurance plans & claims',
  },
  {
    id: 'nutritionist',
    name: 'Nutritionist',
    icon: 'restaurant-menu',
    color: BrandColors.service.nutritionist,
    roleId: 'pet_nutritionist',
    description: 'Diet plans & food delivery',
  },
  {
    id: 'behaviorist',
    name: 'Behaviorist',
    icon: 'psychology',
    color: BrandColors.service.behaviorist,
    roleId: 'pet_behaviorist',
    description: 'Behavior consultation',
  },
  {
    id: 'ambulance',
    name: 'Ambulance',
    icon: 'local-hospital',
    color: BrandColors.semantic.error,
    roleId: 'ambulance',
    description: 'Emergency pet ambulance',
  },
  {
    id: 'holiday',
    name: 'Pet Holidays',
    icon: 'flight',
    color: BrandColors.service.holiday,
    roleId: 'pet_holiday',
    description: 'Holiday packages & tours',
  },
];

interface HomeScreenProps {
  navigation?: any;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    // Refresh user data, bookings, etc.
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleServiceSelect = (category: ServiceCategory) => {
    // Navigate to problem grid or service selection
    navigation?.navigate('ProblemGrid', {
      roleId: category.roleId,
      roleName: category.name,
    });
  };

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
          <View style={styles.headerTop}>
            <View>
              <Text style={[Typography.h2, styles.greeting]}>
                {user?.name ? `Hello, ${user.name.split(' ')[0]}!` : 'Hello!'}
              </Text>
              <Text style={[Typography.bodySmall, styles.subtitle]}>
                How can we help your pet today?
              </Text>
            </View>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigation?.navigate('Notifications')}
            >
              <Icon name="notifications" size={24} color={BrandColors.neutral.gray700} />
              <View style={styles.badge} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Service Categories Grid */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Services</Text>
          <View style={styles.categoriesGrid}>
            {SERVICE_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={styles.categoryCard}
                onPress={() => handleServiceSelect(category)}
                activeOpacity={0.7}
              >
                <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                  <Icon name={category.icon} size={32} color={category.color} />
                </View>
                <Text style={[Typography.bodySmall, styles.categoryName]} numberOfLines={1}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation?.navigate('Bookings')}
            >
              <Icon name="calendar-today" size={24} color={BrandColors.primary.orange} />
              <Text style={[Typography.bodySmall, styles.quickActionText]}>My Bookings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation?.navigate('Pets')}
            >
              <Icon name="pets" size={24} color={BrandColors.primary.orange} />
              <Text style={[Typography.bodySmall, styles.quickActionText]}>My Pets</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation?.navigate('Wallet')}
            >
              <Icon name="account-balance-wallet" size={24} color={BrandColors.primary.orange} />
              <Text style={[Typography.bodySmall, styles.quickActionText]}>Wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation?.navigate('Search')}
            >
              <Icon name="search" size={24} color={BrandColors.primary.orange} />
              <Text style={[Typography.bodySmall, styles.quickActionText]}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    backgroundColor: BrandColors.primary.orange,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    color: '#FFFFFF',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: '#FFFFFF',
    opacity: 0.9,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.semantic.error,
  },
  section: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.base,
  },
  categoryCard: {
    width: '30%',
    alignItems: 'center',
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryName: {
    color: BrandColors.neutral.gray700,
    textAlign: 'center',
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.base,
  },
  quickActionCard: {
    flex: 1,
    minWidth: '45%',
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  quickActionText: {
    color: BrandColors.neutral.gray700,
    fontWeight: '600',
  },
});

