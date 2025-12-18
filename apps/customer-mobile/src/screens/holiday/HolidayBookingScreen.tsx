/**
 * Holiday Booking Screen - Customer Mobile App
 * Book a holiday package
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
  TextInput,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import HolidayService, { HolidayPackage } from '../../services/HolidayService';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { format, addDays } from 'date-fns';

interface HolidayBookingScreenProps {
  route?: {
    params?: {
      packageId: string;
    };
  };
  navigation?: any;
}

export default function HolidayBookingScreen({
  route,
  navigation,
}: HolidayBookingScreenProps) {
  const { user } = useAuth();
  const packageId = route?.params?.packageId || '';

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [packageData, setPackageData] = useState<HolidayPackage | null>(null);
  const [selectedStartDate, setSelectedStartDate] = useState<Date>(addDays(new Date(), 7));
  const [selectedEndDate, setSelectedEndDate] = useState<Date>(addDays(new Date(), 14));
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [selectedPets, setSelectedPets] = useState<Array<{ petId: string; petName: string }>>([]);
  const [specialRequests, setSpecialRequests] = useState('');
  const [userPets, setUserPets] = useState<any[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);

  useEffect(() => {
    loadPackageData();
    loadUserPets();
  }, [packageId]);

  useEffect(() => {
    if (packageData) {
      const price = HolidayService.calculatePrice(packageData, {
        adults,
        children,
        pets: selectedPets.length,
      });
      setTotalPrice(price);
    }
  }, [packageData, adults, children, selectedPets.length]);

  const loadPackageData = async () => {
    try {
      setLoading(true);
      const pkg = await HolidayService.getPackageDetails(packageId);
      if (pkg) {
        setPackageData(pkg);
        // Set end date based on package duration
        if (pkg.duration.days) {
          setSelectedEndDate(addDays(selectedStartDate, pkg.duration.days));
        }
      } else {
        Alert.alert('Error', 'Package not found');
        navigation?.goBack();
      }
    } catch (error) {
      console.error('Error loading package:', error);
      Alert.alert('Error', 'Failed to load package details');
    } finally {
      setLoading(false);
    }
  };

  const loadUserPets = async () => {
    try {
      // TODO: Load user's pets from API
      setUserPets([]);
    } catch (error) {
      console.error('Error loading pets:', error);
    }
  };

  const togglePet = (pet: any) => {
    const isSelected = selectedPets.some((p) => p.petId === pet.id);
    if (isSelected) {
      setSelectedPets(selectedPets.filter((p) => p.petId !== pet.id));
    } else {
      setSelectedPets([...selectedPets, { petId: pet.id, petName: pet.name }]);
    }
  };

  const handleBooking = async () => {
    if (!packageData) return;

    if (selectedStartDate >= selectedEndDate) {
      Alert.alert('Invalid Dates', 'End date must be after start date');
      return;
    }

    if (selectedPets.length === 0) {
      Alert.alert('Required', 'Please select at least one pet');
      return;
    }

    try {
      setBooking(true);
      const result = await HolidayService.bookPackage(
        packageId,
        format(selectedStartDate, 'yyyy-MM-dd'),
        format(selectedEndDate, 'yyyy-MM-dd'),
        {
          adults,
          children,
          pets: selectedPets,
        },
        specialRequests
      );

      if (result) {
        Alert.alert(
          'Booking Requested',
          'Your holiday package booking has been requested. The provider will confirm shortly.',
          [
            {
              text: 'OK',
              onPress: () =>
                navigation?.navigate('BookingConfirmation', { bookingId: result.bookingId }),
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to create booking');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      Alert.alert('Error', 'Failed to create booking');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading package details...
        </Text>
      </View>
    );
  }

  if (!packageData) {
    return null;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[Typography.h2, styles.headerTitle]}>{packageData.packageName}</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              {packageData.destination}
            </Text>
          </View>
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Travel Dates</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateContainer}>
              <Text style={[Typography.bodySmall, styles.dateLabel]}>Start Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  // TODO: Open date picker
                  Alert.alert('Date Picker', 'Select start date');
                }}
              >
                <Icon name="calendar-today" size={20} color={BrandColors.primary.orange} />
                <Text style={[Typography.body, styles.dateText]}>
                  {format(selectedStartDate, 'MMM d, yyyy')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateContainer}>
              <Text style={[Typography.bodySmall, styles.dateLabel]}>End Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  // TODO: Open date picker
                  Alert.alert('Date Picker', 'Select end date');
                }}
              >
                <Icon name="calendar-today" size={20} color={BrandColors.primary.orange} />
                <Text style={[Typography.body, styles.dateText]}>
                  {format(selectedEndDate, 'MMM d, yyyy')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.durationContainer}>
            <Text style={[Typography.body, styles.durationText]}>
              {packageData.duration.days} days / {packageData.duration.nights} nights
            </Text>
          </View>
        </View>

        {/* Travelers */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Travelers</Text>
          <View style={styles.travelersRow}>
            <View style={styles.travelerContainer}>
              <Text style={[Typography.bodySmall, styles.travelerLabel]}>Adults</Text>
              <View style={styles.countControls}>
                <TouchableOpacity
                  style={styles.countButton}
                  onPress={() => setAdults(Math.max(1, adults - 1))}
                >
                  <Icon name="remove" size={20} color={BrandColors.primary.orange} />
                </TouchableOpacity>
                <Text style={[Typography.h4, styles.countValue]}>{adults}</Text>
                <TouchableOpacity
                  style={styles.countButton}
                  onPress={() => setAdults(adults + 1)}
                >
                  <Icon name="add" size={20} color={BrandColors.primary.orange} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.travelerContainer}>
              <Text style={[Typography.bodySmall, styles.travelerLabel]}>Children</Text>
              <View style={styles.countControls}>
                <TouchableOpacity
                  style={styles.countButton}
                  onPress={() => setChildren(Math.max(0, children - 1))}
                >
                  <Icon name="remove" size={20} color={BrandColors.primary.orange} />
                </TouchableOpacity>
                <Text style={[Typography.h4, styles.countValue]}>{children}</Text>
                <TouchableOpacity
                  style={styles.countButton}
                  onPress={() => setChildren(children + 1)}
                >
                  <Icon name="add" size={20} color={BrandColors.primary.orange} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Pet Selection */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Select Pets</Text>
          {userPets.length === 0 ? (
            <View style={styles.emptyPets}>
              <Text style={[Typography.bodySmall, styles.emptyText]}>
                No pets registered. Please add a pet first.
              </Text>
              <BrandedButton
                title="Add Pet"
                onPress={() => navigation?.navigate('PetProfile', { prefillData: null })}
                variant="secondary"
                fullWidth
              />
            </View>
          ) : (
            <View style={styles.petsList}>
              {userPets.map((pet) => {
                const isSelected = selectedPets.some((p) => p.petId === pet.id);
                return (
                  <TouchableOpacity
                    key={pet.id}
                    style={[styles.petCard, isSelected && styles.petCardSelected]}
                    onPress={() => togglePet(pet)}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                      size={24}
                      color={isSelected ? BrandColors.primary.orange : BrandColors.neutral.gray400}
                    />
                    <View style={styles.petInfo}>
                      <Text
                        style={[
                          Typography.body,
                          styles.petName,
                          isSelected && styles.petNameSelected,
                        ]}
                      >
                        {pet.name}
                      </Text>
                      {pet.breed && (
                        <Text style={[Typography.bodyTiny, styles.petBreed]}>{pet.breed}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Special Requests */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Special Requests (Optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Any special requests or requirements..."
            placeholderTextColor={BrandColors.neutral.gray400}
            value={specialRequests}
            onChangeText={setSpecialRequests}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Price Breakdown */}
        <View style={styles.priceCard}>
          <Text style={[Typography.h3, styles.priceTitle]}>Price Breakdown</Text>
          <View style={styles.priceRow}>
            <Text style={[Typography.body, styles.priceLabel]}>Base Price</Text>
            <Text style={[Typography.body, styles.priceValue]}>
              ₹{packageData.pricing.basePrice.toLocaleString()}
            </Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={[Typography.body, styles.priceLabel]}>
              Adults ({adults} × ₹{packageData.pricing.pricePerAdult})
            </Text>
            <Text style={[Typography.body, styles.priceValue]}>
              ₹{(packageData.pricing.pricePerAdult * adults).toLocaleString()}
            </Text>
          </View>
          {children > 0 && (
            <View style={styles.priceRow}>
              <Text style={[Typography.body, styles.priceLabel]}>
                Children ({children} × ₹{packageData.pricing.pricePerChild})
              </Text>
              <Text style={[Typography.body, styles.priceValue]}>
                ₹{(packageData.pricing.pricePerChild * children).toLocaleString()}
              </Text>
            </View>
          )}
          {selectedPets.length > 0 && (
            <View style={styles.priceRow}>
              <Text style={[Typography.body, styles.priceLabel]}>
                Pets ({selectedPets.length} × ₹{packageData.pricing.pricePerPet})
              </Text>
              <Text style={[Typography.body, styles.priceValue]}>
                ₹{(packageData.pricing.pricePerPet * selectedPets.length).toLocaleString()}
              </Text>
            </View>
          )}
          <View style={[styles.priceRow, styles.priceTotal]}>
            <Text style={[Typography.h4, styles.priceLabel]}>Total</Text>
            <Text style={[Typography.h4, styles.priceTotalValue]}>
              ₹{totalPrice.toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Book Button */}
      <View style={styles.footer}>
        <BrandedButton
          title={booking ? 'Booking...' : `Book for ₹${totalPrice.toLocaleString()}`}
          onPress={handleBooking}
          disabled={booking || selectedPets.length === 0}
          variant="primary"
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
    paddingBottom: Spacing.xl + 100,
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
  section: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  dateContainer: {
    flex: 1,
  },
  dateLabel: {
    color: BrandColors.neutral.gray700,
    marginBottom: Spacing.xs,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  dateText: {
    color: BrandColors.neutral.gray900,
  },
  durationContainer: {
    marginTop: Spacing.base,
    padding: Spacing.base,
    backgroundColor: BrandColors.primary.orange + '10',
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  durationText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  travelersRow: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  travelerContainer: {
    flex: 1,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  travelerLabel: {
    color: BrandColors.neutral.gray700,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  countControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.base,
  },
  countButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.primary.orange + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countValue: {
    color: BrandColors.neutral.gray900,
    minWidth: 40,
    textAlign: 'center',
  },
  emptyPets: {
    padding: Spacing.base,
    alignItems: 'center',
  },
  emptyText: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.base,
  },
  petsList: {
    gap: Spacing.base,
  },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
  },
  petCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  petNameSelected: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  petBreed: {
    color: BrandColors.neutral.gray600,
  },
  textArea: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  priceCard: {
    margin: Spacing.lg,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  priceTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  priceTotal: {
    marginTop: Spacing.base,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
  priceLabel: {
    color: BrandColors.neutral.gray700,
  },
  priceValue: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  priceTotalValue: {
    color: BrandColors.primary.orange,
    fontWeight: '700',
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
    backgroundColor: '#FFFFFF',
  },
});
