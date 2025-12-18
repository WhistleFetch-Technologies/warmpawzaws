/**
 * Service Selection Screen - Customer Mobile App
 * Select services from a vendor after vendor selection
 * Matches web app service selection flow
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
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getServiceStyleFromService, getDefaultServiceStyleForRole } from '../../utils/serviceStyleMapping';

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number; // in minutes
  category?: string;
  isPackage?: boolean;
  packageSessions?: number;
}

interface ServiceSelectionScreenProps {
  route?: {
    params?: {
      vendorId?: string;
      vendorName?: string;
      roleId?: string;
      problemId?: string;
    };
  };
  navigation?: any;
}

export default function ServiceSelectionScreen({
  route,
  navigation,
}: ServiceSelectionScreenProps) {
  const { user } = useAuth();
  const vendorId = route?.params?.vendorId || '';
  const vendorName = route?.params?.vendorName || 'Service Provider';
  const roleId = route?.params?.roleId || '';
  const problemId = route?.params?.problemId;

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedPet, setSelectedPet] = useState<any>(null);

  useEffect(() => {
    loadServices();
    loadPets();
  }, [vendorId]);

  const loadServices = async () => {
    try {
      setLoading(true);
      // TODO: Implement API call to fetch vendor services
      // For now, using placeholder
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/available-services/all`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
      } else {
        // Placeholder services for development
        setServices([
          {
            id: '1',
            name: 'Consultation',
            description: 'General consultation',
            price: 500,
            duration: 30,
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading services:', error);
      // Placeholder for development
      setServices([
        {
          id: '1',
          name: 'Consultation',
          description: 'General consultation',
          price: 500,
          duration: 30,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadPets = async () => {
    try {
      // TODO: Load user's pets
      // For now, placeholder
    } catch (error) {
      console.error('Error loading pets:', error);
    }
  };

  const toggleService = (service: Service) => {
    setSelectedServices((prev) => {
      const isSelected = prev.some((s) => s.id === service.id);
      if (isSelected) {
        return prev.filter((s) => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  const handleContinue = () => {
    // Handle specialized services
    if (roleId === 'pet_cafe') {
      navigation?.navigate('CafeBooking', {
        vendorId,
        vendorName,
      });
      return;
    }

    if (roleId === 'pet_resort' || roleId === 'boarding_center') {
      navigation?.navigate('ResortBooking', {
        vendorId,
        vendorName,
      });
      return;
    }

    if (roleId === 'pet_insurance') {
      navigation?.navigate('InsurancePlans', {
        vendorId,
      });
      return;
    }

    if (roleId === 'pet_holiday') {
      navigation?.navigate('HolidayPackages');
      return;
    }

    if (roleId === 'pet_nutritionist') {
      navigation?.navigate('NutritionistMenu', {
        nutritionistId: vendorId,
        nutritionistName: vendorName,
      });
      return;
    }

    // Standard service flow
    if (selectedServices.length === 0) {
      Alert.alert('Select Service', 'Please select at least one service');
      return;
    }

    // Determine service style from selected service (or use default for role)
    const firstService = selectedServices[0];
    const serviceType = getServiceStyleFromService(firstService) || getDefaultServiceStyleForRole(roleId);

    // Navigate to pet selection or time slot selection
    if (!selectedPet) {
      // Navigate to pet selection first
      navigation?.navigate('PetSelection', {
        vendorId,
        vendorName,
        roleId,
        problemId,
        services: selectedServices,
        serviceType, // Pass service type to pet selection
      });
    } else {
      // Navigate directly to time slot selection
      navigation?.navigate('TimeSlotSelection', {
        vendorId,
        serviceId: selectedServices[0].id,
        serviceType,
        petId: selectedPet.id,
        services: selectedServices,
      });
    }
  };

  const totalAmount = selectedServices.reduce((sum, service) => sum + service.price, 0);

  if (loading) {
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
            <Text style={[Typography.h2, styles.headerTitle]} numberOfLines={1}>
              {vendorName}
            </Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              Select services
            </Text>
          </View>
        </View>

        {/* Services List */}
        {services.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="inventory" size={48} color={BrandColors.neutral.gray300} />
            <Text style={[Typography.body, styles.emptyText]}>
              No services available
            </Text>
          </View>
        ) : (
          <View style={styles.servicesList}>
            {services.map((service) => {
              const isSelected = selectedServices.some((s) => s.id === service.id);
              return (
                <TouchableOpacity
                  key={service.id}
                  style={[
                    styles.serviceCard,
                    isSelected && styles.serviceCardSelected,
                  ]}
                  onPress={() => toggleService(service)}
                  activeOpacity={0.7}
                >
                  <View style={styles.serviceHeader}>
                    <View style={styles.serviceInfo}>
                      <Text style={[Typography.h4, styles.serviceName]}>
                        {service.name}
                      </Text>
                      {service.description && (
                        <Text style={[Typography.bodySmall, styles.serviceDescription]}>
                          {service.description}
                        </Text>
                      )}
                      <View style={styles.serviceDetails}>
                        <View style={styles.detailItem}>
                          <Icon name="schedule" size={16} color={BrandColors.neutral.gray500} />
                          <Text style={[Typography.bodyTiny, styles.detailText]}>
                            {service.duration} min
                          </Text>
                        </View>
                        {service.isPackage && service.packageSessions && (
                          <View style={styles.detailItem}>
                            <Icon name="event" size={16} color={BrandColors.neutral.gray500} />
                            <Text style={[Typography.bodyTiny, styles.detailText]}>
                              {service.packageSessions} sessions
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.serviceRight}>
                      <Text style={[Typography.h4, styles.servicePrice]}>
                        ₹{service.price}
                      </Text>
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && styles.checkboxSelected,
                        ]}
                      >
                        {isSelected && (
                          <Icon name="check" size={20} color="#FFFFFF" />
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Total Amount */}
        {selectedServices.length > 0 && (
          <View style={styles.totalContainer}>
            <Text style={[Typography.body, styles.totalLabel]}>Total</Text>
            <Text style={[Typography.h3, styles.totalAmount]}>₹{totalAmount}</Text>
          </View>
        )}
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <BrandedButton
          title={
            selectedServices.length === 0
              ? 'Select a Service'
              : `Continue (${selectedServices.length} selected)`
          }
          onPress={handleContinue}
          disabled={selectedServices.length === 0}
          fullWidth
        />
      </View>
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
    paddingBottom: Spacing.xl + 80, // Space for footer
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
  servicesList: {
    padding: Spacing.lg,
    gap: Spacing.base,
  },
  serviceCard: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
  },
  serviceCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  serviceDescription: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.sm,
  },
  serviceDetails: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailText: {
    color: BrandColors.neutral.gray600,
  },
  serviceRight: {
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  servicePrice: {
    color: BrandColors.primary.orange,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: BrandColors.primary.orange,
    borderColor: BrandColors.primary.orange,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: BrandColors.neutral.gray50,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
  totalLabel: {
    color: BrandColors.neutral.gray700,
    fontWeight: '600',
  },
  totalAmount: {
    color: BrandColors.primary.orange,
  },
  footer: {
    padding: Spacing.lg,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
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
  },
});

