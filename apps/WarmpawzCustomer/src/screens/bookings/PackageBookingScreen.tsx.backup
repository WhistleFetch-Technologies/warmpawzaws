/**
 * Package Booking Screen - Mobile
 * Book service packages (multi-session)
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
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface PackageBookingScreenProps {
  serviceType: string;
  vendorId?: string;
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId: string) => void;
}

interface Package {
  id: string;
  name: string;
  description: string;
  sessions: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  price: number;
  originalPrice?: number;
  duration: number; // minutes per session
  features: string[];
}

interface Pet {
  id: string;
  name: string;
  type: string;
}

export function PackageBookingScreen({
  serviceType,
  vendorId,
  phone,
  customerId,
  onBack,
  onNavigate,
  onSuccess,
}: PackageBookingScreenProps) {
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [startDate, setStartDate] = useState<string>('');

  useEffect(() => {
    loadPackages();
    loadPets();
  }, []);

  const loadPackages = async () => {
    try {
      // ✅ FIX: Use actual API call instead of mock data
      if (vendorId) {
        const response = await CustomerApi.getVendorPackages(vendorId, serviceType);
        const packagesData = (response as any).packages || (response as any).data?.packages || [];
        setPackages(Array.isArray(packagesData) ? packagesData : []);
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      // Set empty array on error instead of mock data
      setPackages([]);
    }
  };

  const loadPets = async () => {
    try {
      if (customerId) {
        const response = await CustomerApi.getPets(customerId);
        const petsData = Array.isArray(response) ? response : response.pets || [];
        setPets(petsData);
        if (petsData.length > 0) {
          setSelectedPet(petsData[0]);
        }
      }
    } catch (error) {
      console.error('Error loading pets:', error);
    }
  };

  const handleBookPackage = async () => {
    if (!selectedPackage || !selectedPet || !startDate) {
      Alert.alert('Error', 'Please select package, pet, and start date');
      return;
    }

    try {
      setLoading(true);

      const bookingData = {
        phone,
        customerId,
        serviceType,
        serviceName: selectedPackage.name,
        vendorId,
        petId: selectedPet.id,
        petName: selectedPet.name,
        serviceStyle: 'at_center',
        isPackage: true,
        packageDetails: {
          packageId: selectedPackage.id,
          totalSessions: selectedPackage.sessions,
          frequency: selectedPackage.frequency,
          duration: selectedPackage.duration,
          startDate,
        },
        price: selectedPackage.price,
        totalAmount: selectedPackage.price,
      };

      const response = await CustomerApi.createBooking(bookingData);

      if (response.bookingId || response.id) {
        Alert.alert(
          'Package Booked',
          `${selectedPackage.name} has been booked successfully.`,
          [
            {
              text: 'OK',
              onPress: () => {
                if (onSuccess) {
                  onSuccess(response.bookingId || response.id);
                } else if (onNavigate) {
                  onNavigate('BookingDetail', { bookingId: response.bookingId || response.id });
                }
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Error booking package:', error);
      Alert.alert('Error', error.message || 'Failed to book package');
    } finally {
      setLoading(false);
    }
  };

  const getFrequencyLabel = (freq: string) => {
    const labels: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      biweekly: 'Bi-weekly',
      monthly: 'Monthly',
    };
    return labels[freq] || freq;
  };

  const discount = selectedPackage && selectedPackage.originalPrice
    ? Math.round(((selectedPackage.originalPrice - selectedPackage.price) / selectedPackage.originalPrice) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Package Booking</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Package Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Package</Text>
          {packages.map((pkg) => (
            <TouchableOpacity
              key={pkg.id}
              style={[
                styles.packageCard,
                selectedPackage?.id === pkg.id && styles.packageCardSelected,
              ]}
              onPress={() => setSelectedPackage(pkg)}
            >
              <View style={styles.packageHeader}>
                <View style={styles.packageInfo}>
                  <Text style={styles.packageName}>{pkg.name}</Text>
                  <Text style={styles.packageDescription}>{pkg.description}</Text>
                </View>
                {selectedPackage?.id === pkg.id && (
                  <View style={styles.selectedIndicator}>
                    <Text style={styles.selectedCheck}>✓</Text>
                  </View>
                )}
              </View>
              <View style={styles.packageDetails}>
                <View style={styles.packageDetailRow}>
                  <Text style={styles.packageDetailLabel}>Sessions</Text>
                  <Text style={styles.packageDetailValue}>{pkg.sessions}</Text>
                </View>
                <View style={styles.packageDetailRow}>
                  <Text style={styles.packageDetailLabel}>Frequency</Text>
                  <Text style={styles.packageDetailValue}>{getFrequencyLabel(pkg.frequency)}</Text>
                </View>
                <View style={styles.packageDetailRow}>
                  <Text style={styles.packageDetailLabel}>Duration per Session</Text>
                  <Text style={styles.packageDetailValue}>{pkg.duration} min</Text>
                </View>
              </View>
              <View style={styles.packageFeatures}>
                {pkg.features.map((feature, index) => (
                  <Text key={index} style={styles.featureItem}>✓ {feature}</Text>
                ))}
              </View>
              <View style={styles.packagePrice}>
                <Text style={styles.price}>₹{pkg.price.toLocaleString()}</Text>
                {pkg.originalPrice && (
                  <>
                    <Text style={styles.originalPrice}>₹{pkg.originalPrice.toLocaleString()}</Text>
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>{discount}% OFF</Text>
                    </View>
                  </>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Pet Selection */}
        {pets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Pet</Text>
            {pets.map((pet) => (
              <TouchableOpacity
                key={pet.id}
                style={[
                  styles.petCard,
                  selectedPet?.id === pet.id && styles.petCardSelected,
                ]}
                onPress={() => setSelectedPet(pet)}
              >
                <Text style={styles.petName}>{pet.name}</Text>
                <Text style={styles.petType}>{pet.type}</Text>
                {selectedPet?.id === pet.id && (
                  <View style={styles.selectedIndicator}>
                    <Text style={styles.selectedCheck}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Start Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Start Date</Text>
          <TouchableOpacity style={styles.dateButton}>
            <Text style={styles.dateButtonText}>
              {startDate || 'Select start date'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.helperText}>
            Package sessions will begin from this date
          </Text>
        </View>

        {/* Book Button */}
        <TouchableOpacity
          style={[styles.bookButton, (!selectedPackage || !selectedPet || !startDate || loading) && styles.bookButtonDisabled]}
          onPress={handleBookPackage}
          disabled={!selectedPackage || !selectedPet || !startDate || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.bookButtonText}>
              Book Package • ₹{selectedPackage?.price.toLocaleString() || '0'}
            </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  packageCard: {
    backgroundColor: '#fff',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  packageCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#fff7ed',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  packageInfo: {
    flex: 1,
  },
  packageName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  packageDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  packageDetails: {
    marginBottom: spacing.md,
  },
  packageDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  packageDetailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  packageDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  packageFeatures: {
    marginBottom: spacing.md,
  },
  featureItem: {
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  packagePrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  originalPrice: {
    fontSize: 18,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  discountText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: 'bold',
  },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  petCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#fff7ed',
  },
  petName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  petType: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  dateButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  dateButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  bookButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  bookButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

