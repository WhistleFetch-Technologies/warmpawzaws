/**
 * Services Screen - Vendor Mobile App
 * Lists and manages vendor services
 * Matches web app VendorServiceConfigurationScreen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Switch,
  Alert,
  FlatList,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import { BrandedButton } from '../../components/BrandedButton';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface Service {
  id: string;
  name: string;
  description: string;
  categoryName: string;
  subCategoryName?: string;
  duration: number;
  price: number;
  isPlatformManaged: boolean;
  isEnabled: boolean;
  customPrice?: number;
  customDuration?: number;
  customDescription?: string;
  serviceStyle?: 'at_home' | 'at_center' | 'tele';
  petTypes?: string[];
  icon?: string;
}

export default function ServicesScreen({ navigation }: any) {
  const { vendor } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeStyle, setActiveStyle] = useState<'at_home' | 'at_center' | 'tele' | 'all'>('all');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (vendor?.id) {
      loadServices();
    }
  }, [vendor, activeStyle]);

  const loadServices = async () => {
    try {
      setLoading(true);
      
      const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;
      
      // Load services based on style filter
      const endpoint = activeStyle === 'all'
        ? `${API_BASE}/vendor/services/${vendor?.id}`
        : `${API_BASE}/vendor/${vendor?.id}/services/${activeStyle}`;
      
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      if (response.ok) {
        const data = await response.json();
        
        // Handle different response formats
        let servicesList: Service[] = [];
        
        if (data.allServices && Array.isArray(data.allServices)) {
          servicesList = data.allServices;
        } else if (data.services && typeof data.services === 'object') {
          // Grouped by style
          ['at_home', 'at_center', 'tele'].forEach((style) => {
            if (data.services[style]?.services) {
              servicesList.push(...data.services[style].services);
            }
          });
        } else if (Array.isArray(data.services)) {
          servicesList = data.services;
        }
        
        setServices(servicesList);
      }
    } catch (error) {
      console.error('Error loading services:', error);
      Alert.alert('Error', 'Failed to load services');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleService = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    const newEnabled = !service.isEnabled;
    
    // Optimistic update
    setServices(services.map(s => 
      s.id === serviceId ? { ...s, isEnabled: newEnabled } : s
    ));
    setHasChanges(true);

    try {
      const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;
      const response = await fetch(
        `${API_BASE}/vendor/services/${serviceId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            isEnabled: newEnabled,
          }),
        }
      );

      if (!response.ok) {
        // Revert on error
        setServices(services.map(s => 
          s.id === serviceId ? { ...s, isEnabled: !newEnabled } : s
        ));
        throw new Error('Failed to update service');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update service status');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadServices();
  };

  const getServiceIcon = (categoryName: string) => {
    const category = categoryName?.toLowerCase() || '';
    if (category.includes('groom')) return 'content-cut';
    if (category.includes('vet') || category.includes('health')) return 'medical-services';
    if (category.includes('train')) return 'school';
    if (category.includes('walk')) return 'directions-walk';
    if (category.includes('board')) return 'hotel';
    return 'business-center';
  };

  const renderServiceItem = (service: Service) => (
    <View key={service.id} style={styles.serviceCard}>
      <View style={styles.serviceHeader}>
        <View style={styles.serviceIconContainer}>
          <Icon
            name={getServiceIcon(service.categoryName)}
            size={24}
            color={BrandColors.primary.orange}
          />
        </View>
        <View style={styles.serviceInfo}>
          <Text style={[Typography.h4, styles.serviceName]}>
            {service.name}
          </Text>
          <Text style={[Typography.bodySmall, styles.serviceCategory]}>
            {service.categoryName}
            {service.subCategoryName && ` • ${service.subCategoryName}`}
          </Text>
        </View>
        <Switch
          value={service.isEnabled}
          onValueChange={() => handleToggleService(service.id)}
          trackColor={{
            false: BrandColors.neutral.gray300,
            true: BrandColors.primary.orange,
          }}
          thumbColor="#FFFFFF"
        />
      </View>

      {service.description && (
        <Text style={[Typography.bodySmall, styles.serviceDescription]} numberOfLines={2}>
          {service.description}
        </Text>
      )}

      <View style={styles.serviceDetails}>
        <View style={styles.serviceDetailItem}>
          <Icon name="schedule" size={16} color={BrandColors.neutral.gray600} />
          <Text style={[Typography.bodySmall, styles.serviceDetailText]}>
            {service.customDuration || service.duration} min
          </Text>
        </View>
        <View style={styles.serviceDetailItem}>
          <Icon name="attach-money" size={16} color={BrandColors.semantic.success} />
          <Text style={[Typography.bodySmall, styles.serviceDetailText]}>
            ₹{service.customPrice || service.price}
          </Text>
        </View>
        {service.serviceStyle && (
          <View style={styles.serviceDetailItem}>
            <Icon name="place" size={16} color={BrandColors.neutral.gray600} />
            <Text style={[Typography.bodySmall, styles.serviceDetailText]}>
              {service.serviceStyle === 'at_home' ? 'At Home' : 
               service.serviceStyle === 'at_center' ? 'At Center' : 'Tele'}
            </Text>
          </View>
        )}
      </View>

      {service.isEnabled && (
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => {
            navigation?.navigate('ServiceDetail', {
              serviceId: service.id,
              service: service,
            });
          }}
        >
          <Icon name="edit" size={16} color={BrandColors.primary.orange} />
          <Text style={[Typography.bodySmall, styles.editButtonText]}>
            Edit Details
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading && services.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading services...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header with Add Button */}
      <View style={styles.header}>
        <Text style={[Typography.h2, styles.title]}>Services</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            navigation?.navigate('ServiceDetail', { mode: 'create' });
          }}
        >
          <Icon name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Style Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {(['all', 'at_home', 'at_center', 'tele'] as const).map((style) => (
            <TouchableOpacity
              key={style}
              style={[
                styles.filterButton,
                activeStyle === style && styles.filterButtonActive,
              ]}
              onPress={() => setActiveStyle(style)}
            >
              <Text
                style={[
                  Typography.bodySmall,
                  activeStyle === style && styles.filterButtonTextActive,
                ]}
              >
                {style === 'all' ? 'All' :
                 style === 'at_home' ? 'At Home' :
                 style === 'at_center' ? 'At Center' : 'Tele'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Services List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={BrandColors.primary.orange}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {services.length > 0 ? (
          <View style={styles.servicesList}>
            {services.map(renderServiceItem)}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="business-center" size={64} color={BrandColors.neutral.gray300} />
            <Text style={[Typography.h3, styles.emptyTitle]}>No Services</Text>
            <Text style={[Typography.bodySmall, styles.emptyText]}>
              {activeStyle === 'all'
                ? "You haven't added any services yet"
                : `No ${activeStyle} services found`}
            </Text>
            <BrandedButton
              title="Add Service"
              onPress={() => {
                navigation?.navigate('ServiceDetail', { mode: 'create' });
              }}
              fullWidth
              style={styles.emptyButton}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  title: {
    color: BrandColors.neutral.gray900,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BrandColors.primary.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    backgroundColor: BrandColors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
    paddingVertical: Spacing.base,
  },
  filtersContent: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  filterButton: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.neutral.gray100,
    marginRight: Spacing.sm,
  },
  filterButtonActive: {
    backgroundColor: BrandColors.primary.orange,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  servicesList: {
    padding: Spacing.base,
    gap: Spacing.base,
  },
  serviceCard: {
    backgroundColor: BrandColors.neutral.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    marginBottom: Spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.base,
  },
  serviceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.primary.orange + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  serviceCategory: {
    color: BrandColors.neutral.gray600,
  },
  serviceDescription: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  serviceDetails: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  serviceDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  serviceDetailText: {
    color: BrandColors.neutral.gray700,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
    alignSelf: 'flex-start',
  },
  editButtonText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    minHeight: 400,
  },
  emptyTitle: {
    color: BrandColors.neutral.gray900,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    color: BrandColors.neutral.gray600,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  emptyButton: {
    maxWidth: 200,
  },
});

