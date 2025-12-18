/**
 * Role Selection Screen - Vendor Mobile App
 * Matches web app VendorRoleSelection component
 * Allows vendors to select their service role
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface Role {
  id: string;
  name: string;
  description: string;
  icon: string;
  features: string[];
  vendorTypes: string[];
  serviceStyles: string[];
  capabilities: string[];
  order: number;
  isActive: boolean;
}

interface RoleSelectionScreenProps {
  navigation?: any;
  onRoleSelect?: (role: Role) => void;
}

export default function RoleSelectionScreen({ navigation, onRoleSelect }: RoleSelectionScreenProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch roles');
      }

      const data = await response.json();
      const activeRoles = data.roles
        .filter((role: Role) => role.isActive)
        .sort((a: Role, b: Role) => a.order - b.order);
      
      setRoles(activeRoles);
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError('Failed to load roles. Please try again.');
      // Fallback roles
      setRoles([
        {
          id: 'service-provider',
          name: 'Pet Service Provider',
          description: 'Offer services like grooming, walking, training, boarding',
          icon: 'business-center',
          features: ['📅 Bookings', '🏠 At Home / Clinic'],
          vendorTypes: ['service'],
          serviceStyles: ['at-home', 'clinic'],
          capabilities: ['📅 Bookings', '🏠 At Home / Clinic'],
          order: 1,
          isActive: true,
        },
        {
          id: 'veterinarian',
          name: 'Veterinarian',
          description: 'Create Prescriptions, manage consultations',
          icon: 'medical-services',
          features: ['📋 Prescriptions', '💬 Consultations'],
          vendorTypes: ['healthcare'],
          serviceStyles: ['clinic'],
          capabilities: ['📋 Prescriptions', '💬 Consultations'],
          order: 2,
          isActive: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    if (onRoleSelect) {
      onRoleSelect(role);
    }
    if (navigation) {
      navigation.navigate('Onboarding', {
        roleId: role.id,
        vendorType: role.vendorTypes[0],
      });
    }
  };

  const getRoleIcon = (iconName: string) => {
    const iconMap: { [key: string]: string } = {
      'business-center': 'business-center',
      'medical-services': 'medical-services',
      'restaurant': 'restaurant',
      'store': 'store',
      'local-pharmacy': 'local-pharmacy',
      'camera-alt': 'camera-alt',
      'pets': 'pets',
      'home': 'home',
    };
    return iconMap[iconName] || 'business-center';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading roles...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[Typography.h1, styles.title]}>
            Choose Your Role
          </Text>
          <Text style={[Typography.bodySmall, styles.subtitle]}>
            Select the type of pet care service you provide
          </Text>
        </View>

        {/* Role Cards */}
        <View style={styles.rolesContainer}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role.id}
              style={[
                styles.roleCard,
                selectedRole?.id === role.id && styles.roleCardSelected,
              ]}
              onPress={() => handleRoleSelect(role)}
              activeOpacity={0.7}
            >
              <View style={styles.roleCardHeader}>
                <View
                  style={[
                    styles.iconContainer,
                    selectedRole?.id === role.id && styles.iconContainerSelected,
                  ]}
                >
                  <Icon
                    name={getRoleIcon(role.icon)}
                    size={32}
                    color={
                      selectedRole?.id === role.id
                        ? '#FFFFFF'
                        : BrandColors.primary.orange
                    }
                  />
                </View>
                <Text style={[Typography.h3, styles.roleName]}>
                  {role.name}
                </Text>
              </View>

              <Text style={[Typography.bodySmall, styles.roleDescription]}>
                {role.description}
              </Text>

              {role.features.length > 0 && (
                <View style={styles.featuresContainer}>
                  {role.features.map((feature, index) => (
                    <View key={index} style={styles.featureTag}>
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
              )}

              {selectedRole?.id === role.id && (
                <View style={styles.selectedIndicator}>
                  <Icon name="check-circle" size={20} color={BrandColors.semantic.success} />
                  <Text style={styles.selectedText}>Selected</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {selectedRole && (
          <View style={styles.continueContainer}>
            <BrandedButton
              title="Continue"
              onPress={() => handleRoleSelect(selectedRole)}
              fullWidth
            />
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.xl,
  },
  header: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  title: {
    color: BrandColors.neutral.gray900,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: BrandColors.neutral.gray600,
    textAlign: 'center',
  },
  rolesContainer: {
    gap: Spacing.base,
    marginBottom: Spacing.xl,
  },
  roleCard: {
    backgroundColor: BrandColors.neutral.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
    marginBottom: Spacing.base,
  },
  roleCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  roleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.primary.orange + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.base,
  },
  iconContainerSelected: {
    backgroundColor: BrandColors.primary.orange,
  },
  roleName: {
    flex: 1,
    color: BrandColors.neutral.gray900,
  },
  roleDescription: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.base,
    lineHeight: 20,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  featureTag: {
    backgroundColor: BrandColors.neutral.gray100,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  featureText: {
    ...Typography.bodyTiny,
    color: BrandColors.neutral.gray700,
  },
  selectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.base,
    gap: Spacing.xs,
  },
  selectedText: {
    ...Typography.bodySmall,
    color: BrandColors.semantic.success,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: BrandColors.semantic.error + '20',
    padding: Spacing.base,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.base,
  },
  errorText: {
    ...Typography.bodySmall,
    color: BrandColors.semantic.error,
    textAlign: 'center',
  },
  continueContainer: {
    marginTop: Spacing.base,
  },
});

