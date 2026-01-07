/**
 * Vendor Role Selection Screen
 * Choose vendor role - Identical to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { VendorApi } from '../../services/api';
import { API_BASE_URL } from '../../config/aws';

interface VendorRoleSelectionScreenProps {
  onRoleSelect: (roleId: string) => void;
}

interface Role {
  id: string;
  name: string;
  description: string;
  icon: string;
  features: string[];
  capabilities: string[];
  order: number;
  isActive: boolean;
}

export function VendorRoleSelectionScreen({ onRoleSelect }: VendorRoleSelectionScreenProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Cleanup
  useEffect(() => {
    fetchRoles();
    
    return () => {
      setRoles([]);
      setError(null);
    };
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      // ✅ FIX: Use API_BASE_URL from AWS config instead of hardcoded Supabase URL
      const response = await fetch(
        `${API_BASE_URL}/config/roles`,
        {
          headers: { 
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch roles');
      }

      const data = await response.json();
      const activeRoles = (data.roles || []).filter((role: Role) => role.isActive);
      const uniqueRoles = Array.from(
        new Map(activeRoles.map((r: Role) => [r.id, r])).values()
      );
      
      setRoles(uniqueRoles as Role[]);
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError('Failed to load roles. Please try again.');
      
      // Fallback roles
      setRoles([
        {
          id: 'service-provider',
          name: 'Pet Service Provider',
          description: 'Offer services like grooming, walking, training, boarding, etc.',
          icon: 'service',
          features: ['📅 Bookings', '🏠 At Home / Clinic'],
          capabilities: ['📅 Bookings', '🏠 At Home / Clinic'],
          order: 1,
          isActive: true,
        },
        {
          id: 'veterinarian',
          name: 'Veterinarian',
          description: 'Create Prescriptions, manage consultations',
          icon: 'healthcare',
          features: ['📋 Prescriptions', '💬 Consultations'],
          capabilities: ['📋 Prescriptions', '💬 Consultations'],
          order: 2,
          isActive: true,
        },
        {
          id: 'pet_product',
          name: 'Pet Product Seller',
          description: 'Sell products, manage inventory, create promotions',
          icon: 'retail',
          features: ['📊 Inventory', '📍 Delivery'],
          capabilities: ['📊 Inventory', '📍 Delivery'],
          order: 3,
          isActive: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (icon: string) => {
    const iconMap: Record<string, string> = {
      service: '🛎️',
      healthcare: '🏥',
      retail: '🛍️',
      veterinarian: '👨‍⚕️',
      groomer: '✂️',
      trainer: '🎓',
      walker: '🚶',
      boarder: '🏠',
    };
    return iconMap[icon.toLowerCase()] || '🐾';
  };

  const getRoleColor = (roleId: string) => {
    if (roleId.includes('vet') || roleId.includes('healthcare')) return '#3b82f6';
    if (roleId.includes('product') || roleId.includes('seller')) return '#8b5cf6';
    return {colors.success};
  };

  const handleSelect = (roleId: string) => {
    setSelectedRole(roleId);
    setTimeout(() => {
      onRoleSelect(roleId);
    }, 300);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading roles...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🐾</Text>
          </View>
          <Text style={styles.title}>Choose Your Role</Text>
          <Text style={styles.subtitle}>
            Select the type of vendor you want to register as
          </Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Role Cards */}
        <View style={styles.rolesContainer}>
          {roles.map((role) => {
            const roleColor = getRoleColor(role.id);
            const isSelected = selectedRole === role.id;
            
            return (
              <TouchableOpacity
                key={role.id}
                style={[
                  styles.roleCard,
                  isSelected && { borderColor: roleColor, backgroundColor: `${roleColor}10` },
                ]}
                onPress={() => handleSelect(role.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: roleColor }]}>
                  <Text style={styles.iconEmoji}>{getRoleIcon(role.icon)}</Text>
                </View>
                <View style={styles.roleContent}>
                  <Text style={styles.roleName}>{role.name}</Text>
                  <Text style={styles.roleDescription}>{role.description}</Text>
                  <View style={styles.featuresContainer}>
                    {role.features.slice(0, 2).map((feature, idx) => (
                      <View key={idx} style={styles.featureBadge}>
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Text style={styles.arrow}>→</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingTop: spacing.xl,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoEmoji: {
    fontSize: 60,
  },
  title: {
    fontSize: typography.fontSizes['3xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSizes.sm,
    textAlign: 'center',
  },
  rolesContainer: {
    gap: spacing.md,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  iconEmoji: {
    fontSize: 28,
  },
  roleContent: {
    flex: 1,
  },
  roleName: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  roleDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  featuresContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  featureBadge: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  featureText: {
    fontSize: typography.fontSizes.xs,
    color: colors.text,
  },
  arrow: {
    fontSize: typography.fontSizes.xl,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
});

