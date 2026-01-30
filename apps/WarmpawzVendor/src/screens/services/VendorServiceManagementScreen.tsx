/**
 * Vendor Service Management Screen
 * Service CRUD operations
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { VendorApi } from '../../services/api';
import { getServiceStyleLabelForRole } from '../../utils/service-style-labels';

interface VendorServiceManagementScreenProps {
  vendorId: string;
  onBack?: () => void;
}

type ServiceStyle = 'at_home' | 'at_center' | 'tele';

export function VendorServiceManagementScreen({
  vendorId,
  onBack,
}: VendorServiceManagementScreenProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serviceCatalog, setServiceCatalog] = useState<any[]>([]);
  const [vendorServices, setVendorServices] = useState<Record<string, any>>({});
  const [serviceStyle, setServiceStyle] = useState<ServiceStyle>('at_home');
  
  // ✅ NEW: Load allowed service styles from backend based on vendor's role
  const [allowedServiceStyles, setAllowedServiceStyles] = useState<ServiceStyle[]>([]);
  const [roleName, setRoleName] = useState<string | null>(null); // ✅ For role-based labels
  const [loadingRoleConfig, setLoadingRoleConfig] = useState(true);

  // ✅ NEW: Load role configuration first to get allowed service styles
  useEffect(() => {
    loadRoleConfiguration();
  }, [vendorId]);
  
  // ✅ Load services only after role config is loaded
  useEffect(() => {
    if (!loadingRoleConfig && allowedServiceStyles.length > 0) {
      loadServices();
    }
  }, [vendorId, serviceStyle, loadingRoleConfig, allowedServiceStyles]);
  
  // ✅ NEW: Fetch role configuration to determine allowed service styles
  const loadRoleConfiguration = async () => {
    try {
      setLoadingRoleConfig(true);
      console.log('🔧 [MOBILE] Loading role config for vendor:', vendorId);
      
      // Use the same endpoint as web app to get vendor services with role config
      const data = await VendorApi.getVendorServicesWithRoleConfig(vendorId);
      
      if (data && data.success) {
        // Extract allowed service styles from backend response
        let allowedStyles = data.allowedServiceStyles || data.allowed_service_styles || [];
        
        // ✅ Map any variant names to standard format
        const styleMapping: Record<string, ServiceStyle> = {
          'at_clinic': 'at_center',
          'at_center': 'at_center',
          'video_consultation': 'tele',
          'tele': 'tele',
          'home_visit': 'at_home',
          'at_home': 'at_home',
        };
        
        allowedStyles = allowedStyles
          .map((s: string) => styleMapping[s] || s)
          .filter((s: string): s is ServiceStyle => ['at_home', 'at_center', 'tele'].includes(s));
        
        // ✅ Remove duplicates
        allowedStyles = [...new Set(allowedStyles)];
        
        console.log('✅ [MOBILE] Allowed service styles:', allowedStyles);
        
        if (allowedStyles.length > 0) {
          setAllowedServiceStyles(allowedStyles);
          // Set initial service style to first allowed style
          setServiceStyle(allowedStyles[0]);
        } else {
          // Fallback to at_home only if no styles configured
          console.warn('⚠️ [MOBILE] No allowed styles found, falling back to at_home');
          setAllowedServiceStyles(['at_home']);
          setServiceStyle('at_home');
        }
      } else {
        console.error('❌ [MOBILE] Failed to load role config:', data?.error);
        // Fallback - most vendors can use at_home
        setAllowedServiceStyles(['at_home']);
        setServiceStyle('at_home');
      }
    } catch (error) {
      console.error('❌ [MOBILE] Error loading role config:', error);
      // Fallback - most vendors can use at_home
      setAllowedServiceStyles(['at_home']);
      setServiceStyle('at_home');
    } finally {
      setLoadingRoleConfig(false);
    }
  };

  const loadServices = async () => {
    try {
      setLoading(true);
      const [catalog, services] = await Promise.all([
        VendorApi.getServiceCatalog(),
        VendorApi.getVendorServices(vendorId, serviceStyle),
      ]);
      setServiceCatalog(catalog.services || []);
      const servicesMap: Record<string, any> = {};
      (services.services || []).forEach((s: any) => {
        servicesMap[s.serviceId] = s;
      });
      setVendorServices(servicesMap);
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (serviceId: string) => {
    if (vendorServices[serviceId]) {
      const updated = { ...vendorServices };
      delete updated[serviceId];
      setVendorServices(updated);
    } else {
      setVendorServices({
        ...vendorServices,
        [serviceId]: {
          serviceId,
          enabled: true,
          price: 0,
          duration: 60,
        },
      });
    }
  };

  const updateServicePrice = (serviceId: string, price: number) => {
    setVendorServices({
      ...vendorServices,
      [serviceId]: {
        ...vendorServices[serviceId],
        price,
      },
    });
  };

  const updateServiceDuration = (serviceId: string, duration: number) => {
    setVendorServices({
      ...vendorServices,
      [serviceId]: {
        ...vendorServices[serviceId],
        duration,
      },
    });
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      const servicesToPublish = Object.values(vendorServices).map((s) => ({
        serviceId: s.serviceId,
        price: s.price || 0,
        duration: s.duration || 60,
        enabled: true,
      }));

      await VendorApi.publishServices(vendorId, {
        serviceStyle,
        services: servicesToPublish,
      });

      Alert.alert('Success', 'Services published successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to publish services. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filteredCatalog = serviceCatalog.filter((s) => s.serviceStyle === serviceStyle);

  // ✅ FIX: Show loading state during role config loading OR service loading
  if (loadingRoleConfig || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {loadingRoleConfig ? 'Loading configuration...' : 'Loading services...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Service Management</Text>
        </View>

        {/* ✅ FIX: Only show tabs for allowed service styles; labels per role (e.g. Training center booking) */}
        <View style={styles.tabs}>
          {allowedServiceStyles.map((style) => {
            const config = getServiceStyleLabelForRole(roleName, style);
            return (
              <TouchableOpacity
                key={style}
                style={[styles.tab, serviceStyle === style && styles.tabActive]}
                onPress={() => setServiceStyle(style)}
              >
                <Text style={styles.tabIcon}>{config.icon}</Text>
                <Text
                  style={[
                    styles.tabText,
                    serviceStyle === style && styles.tabTextActive,
                  ]}
                >
                  {config.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.content}>
          {filteredCatalog.map((service) => {
            const isEnabled = !!vendorServices[service.id];
            const serviceData = vendorServices[service.id] || {};

            return (
              <View key={service.id} style={styles.serviceCard}>
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.serviceDescription}>{service.description}</Text>
                  </View>
                  <Switch
                    value={isEnabled}
                    onValueChange={() => toggleService(service.id)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                </View>

                {isEnabled && (
                  <View style={styles.serviceConfig}>
                    <View style={styles.configRow}>
                      <Text style={styles.configLabel}>Price (₹)</Text>
                      <TextInput
                        style={styles.configInput}
                        value={serviceData.price?.toString() || '0'}
                        onChangeText={(text) => {
                          const price = parseFloat(text) || 0;
                          updateServicePrice(service.id, price);
                        }}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                    <View style={styles.configRow}>
                      <Text style={styles.configLabel}>Duration (min)</Text>
                      <TextInput
                        style={styles.configInput}
                        value={serviceData.duration?.toString() || '60'}
                        onChangeText={(text) => {
                          const duration = parseInt(text) || 60;
                          updateServiceDuration(service.id, duration);
                        }}
                        keyboardType="numeric"
                        placeholder="60"
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.publishButton, saving && styles.publishButtonDisabled]}
          onPress={handlePublish}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.publishButtonText}>Publish Services</Text>
          )}
        </TouchableOpacity>
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
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  title: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  tabs: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  tabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  tabIcon: {
    fontSize: typography.fontSizes.lg,
    marginBottom: spacing.xs / 2,
  },
  tabText: {
    fontSize: typography.fontSizes.xs,
    color: colors.text,
    textAlign: 'center' as const,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  content: {
    padding: spacing.md,
  },
  serviceCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  serviceInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  serviceName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  serviceDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  serviceConfig: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  configInput: {
    width: 100,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    textAlign: 'right',
  },
  publishButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  publishButtonDisabled: {
    opacity: 0.5,
  },
  publishButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
});

