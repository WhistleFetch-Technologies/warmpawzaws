/**
 * Cafe Booking Screen - Customer Mobile App
 * Book a table at a pet cafe
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
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import CafeService, { CafeTable, CafePackage, CafeConfig } from '../../services/CafeService';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { format, addDays, isToday, isTomorrow } from 'date-fns';

interface CafeBookingScreenProps {
  route?: {
    params?: {
      vendorId: string;
      vendorName: string;
    };
  };
  navigation?: any;
}

export default function CafeBookingScreen({
  route,
  navigation,
}: CafeBookingScreenProps) {
  const vendorId = route?.params?.vendorId || '';
  const vendorName = route?.params?.vendorName || '';

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [cafeConfig, setCafeConfig] = useState<CafeConfig | null>(null);
  const [availableTables, setAvailableTables] = useState<CafeTable[]>([]);
  const [partyPackages, setPartyPackages] = useState<CafePackage[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState('');
  const [guests, setGuests] = useState(2);
  const [pets, setPets] = useState(1);
  const [selectedTable, setSelectedTable] = useState<CafeTable | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<CafePackage | null>(null);
  const [specialRequest, setSpecialRequest] = useState('');
  const [dates, setDates] = useState<Date[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  useEffect(() => {
    loadCafeData();
    generateDates();
    generateTimeSlots();
  }, [vendorId]);

  useEffect(() => {
    if (selectedDate && selectedTime) {
      loadAvailableTables();
    }
  }, [selectedDate, selectedTime, guests, pets]);

  const loadCafeData = async () => {
    try {
      setLoading(true);
      const [config, packages] = await Promise.all([
        CafeService.getCafeConfig(vendorId),
        CafeService.getPartyPackages(vendorId),
      ]);

      if (config) {
        setCafeConfig(config);
      }

      if (packages) {
        setPartyPackages(packages);
      }
    } catch (error) {
      console.error('Error loading cafe data:', error);
      Alert.alert('Error', 'Failed to load cafe information');
    } finally {
      setLoading(false);
    }
  };

  const generateDates = () => {
    const dateList: Date[] = [];
    for (let i = 0; i < 14; i++) {
      dateList.push(addDays(new Date(), i));
    }
    setDates(dateList);
  };

  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let hour = 10; hour <= 21; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`);
      if (hour < 21) {
        slots.push(`${String(hour).padStart(2, '0')}:30`);
      }
    }
    setTimeSlots(slots);
  };

  const loadAvailableTables = async () => {
    try {
      const tables = await CafeService.getAvailableTables(
        vendorId,
        format(selectedDate, 'yyyy-MM-dd'),
        selectedTime,
        guests,
        pets
      );
      setAvailableTables(tables);
    } catch (error) {
      console.error('Error loading tables:', error);
    }
  };

  const handleBooking = async () => {
    if (!selectedTable) {
      Alert.alert('Required', 'Please select a table');
      return;
    }

    if (!selectedDate || !selectedTime) {
      Alert.alert('Required', 'Please select date and time');
      return;
    }

    try {
      setBooking(true);
      const result = await CafeService.createReservation(
        vendorId,
        selectedTable.id,
        format(selectedDate, 'yyyy-MM-dd'),
        selectedTime,
        guests,
        pets,
        specialRequest,
        selectedPackage?.id
      );

      if (result) {
        Alert.alert(
          'Reservation Requested',
          'Your table reservation has been requested. The cafe will confirm shortly.',
          [
            {
              text: 'OK',
              onPress: () => navigation?.navigate('BookingConfirmation', { bookingId: result.bookingId }),
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to create reservation');
      }
    } catch (error) {
      console.error('Error creating reservation:', error);
      Alert.alert('Error', 'Failed to create reservation');
    } finally {
      setBooking(false);
    }
  };

  const formatDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading cafe information...
        </Text>
      </View>
    );
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
            <Text style={[Typography.h2, styles.headerTitle]}>{vendorName}</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              Pet Cafe Reservation
            </Text>
          </View>
        </View>

        {/* Cafe Info */}
        {cafeConfig && (
          <View style={styles.infoCard}>
            <Text style={[Typography.h4, styles.infoTitle]}>Cafe Information</Text>
            {cafeConfig.amenities && cafeConfig.amenities.length > 0 && (
              <View style={styles.amenitiesRow}>
                {cafeConfig.amenities.map((amenity, index) => (
                  <View key={index} style={styles.amenityBadge}>
                    <Text style={[Typography.bodyTiny, styles.amenityText]}>{amenity}</Text>
                  </View>
                ))}
              </View>
            )}
            {cafeConfig.petPolicies && cafeConfig.petPolicies.length > 0 && (
              <View style={styles.policiesContainer}>
                <Text style={[Typography.bodySmall, styles.policiesTitle]}>Pet Policies:</Text>
                {cafeConfig.petPolicies.map((policy, index) => (
                  <Text key={index} style={[Typography.bodyTiny, styles.policyText]}>
                    • {policy}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Select Date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.datesContainer}
          >
            {dates.map((date, index) => {
              const isSelected =
                format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                  onPress={() => setSelectedDate(date)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      Typography.bodySmall,
                      isSelected && styles.dateTextSelected,
                    ]}
                  >
                    {format(date, 'd')}
                  </Text>
                  <Text
                    style={[
                      Typography.bodyTiny,
                      styles.dateLabel,
                      isSelected && styles.dateLabelSelected,
                    ]}
                  >
                    {formatDate(date)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Time Selection */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Select Time</Text>
          <View style={styles.timeSlotsGrid}>
            {timeSlots.map((time, index) => {
              const isSelected = selectedTime === time;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.timeSlotCard,
                    isSelected && styles.timeSlotCardSelected,
                  ]}
                  onPress={() => setSelectedTime(time)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      Typography.body,
                      isSelected && styles.timeSlotTextSelected,
                    ]}
                  >
                    {time}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Guest & Pet Count */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Guest & Pet Count</Text>
          <View style={styles.countRow}>
            <View style={styles.countContainer}>
              <Text style={[Typography.bodySmall, styles.countLabel]}>Guests</Text>
              <View style={styles.countControls}>
                <TouchableOpacity
                  style={styles.countButton}
                  onPress={() => setGuests(Math.max(1, guests - 1))}
                >
                  <Icon name="remove" size={20} color={BrandColors.primary.orange} />
                </TouchableOpacity>
                <Text style={[Typography.h4, styles.countValue]}>{guests}</Text>
                <TouchableOpacity
                  style={styles.countButton}
                  onPress={() => setGuests(guests + 1)}
                >
                  <Icon name="add" size={20} color={BrandColors.primary.orange} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.countContainer}>
              <Text style={[Typography.bodySmall, styles.countLabel]}>Pets</Text>
              <View style={styles.countControls}>
                <TouchableOpacity
                  style={styles.countButton}
                  onPress={() => setPets(Math.max(0, pets - 1))}
                >
                  <Icon name="remove" size={20} color={BrandColors.primary.orange} />
                </TouchableOpacity>
                <Text style={[Typography.h4, styles.countValue]}>{pets}</Text>
                <TouchableOpacity
                  style={styles.countButton}
                  onPress={() => setPets(pets + 1)}
                >
                  <Icon name="add" size={20} color={BrandColors.primary.orange} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Party Packages */}
        {partyPackages.length > 0 && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Party Packages (Optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {partyPackages.map((pkg) => {
                const isSelected = selectedPackage?.id === pkg.id;
                return (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[
                      styles.packageCard,
                      isSelected && styles.packageCardSelected,
                    ]}
                    onPress={() => setSelectedPackage(isSelected ? null : pkg)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        Typography.body,
                        styles.packageName,
                        isSelected && styles.packageNameSelected,
                      ]}
                    >
                      {pkg.name}
                    </Text>
                    <Text style={[Typography.bodySmall, styles.packagePrice]}>
                      ₹{pkg.price}
                    </Text>
                    {pkg.inclusions && pkg.inclusions.length > 0 && (
                      <Text style={[Typography.bodyTiny, styles.packageInclusions]}>
                        {pkg.inclusions.join(', ')}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Table Selection */}
        {selectedDate && selectedTime && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Select Table</Text>
            {availableTables.length === 0 ? (
              <View style={styles.emptyTables}>
                <Icon name="table-restaurant" size={48} color={BrandColors.neutral.gray300} />
                <Text style={[Typography.body, styles.emptyText]}>
                  No tables available for this time
                </Text>
                <Text style={[Typography.bodySmall, styles.emptySubtext]}>
                  Try selecting a different date or time
                </Text>
              </View>
            ) : (
              <View style={styles.tablesGrid}>
                {availableTables.map((table) => {
                  const isSelected = selectedTable?.id === table.id;
                  return (
                    <TouchableOpacity
                      key={table.id}
                      style={[
                        styles.tableCard,
                        isSelected && styles.tableCardSelected,
                      ]}
                      onPress={() => setSelectedTable(table)}
                      activeOpacity={0.7}
                    >
                      <Icon
                        name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={24}
                        color={isSelected ? BrandColors.primary.orange : BrandColors.neutral.gray400}
                      />
                      <View style={styles.tableInfo}>
                        <Text
                          style={[
                            Typography.body,
                            styles.tableName,
                            isSelected && styles.tableNameSelected,
                          ]}
                        >
                          {table.name}
                        </Text>
                        <Text style={[Typography.bodyTiny, styles.tableDetails]}>
                          Capacity: {table.capacity} guests
                        </Text>
                        <Text style={[Typography.bodyTiny, styles.tableDetails]}>
                          {table.section} • {table.isOutdoor ? 'Outdoor' : 'Indoor'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Special Request */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Special Request (Optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Any special requests or dietary requirements..."
            placeholderTextColor={BrandColors.neutral.gray400}
            value={specialRequest}
            onChangeText={setSpecialRequest}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      {/* Book Button */}
      <View style={styles.footer}>
        <BrandedButton
          title={booking ? 'Booking...' : 'Request Reservation'}
          onPress={handleBooking}
          disabled={booking || !selectedTable || !selectedDate || !selectedTime}
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
    paddingBottom: Spacing.xl + 80,
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
  infoCard: {
    margin: Spacing.lg,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  infoTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  amenitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  amenityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: BrandColors.primary.orange + '20',
    borderRadius: BorderRadius.sm,
  },
  amenityText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  policiesContainer: {
    marginTop: Spacing.base,
  },
  policiesTitle: {
    color: BrandColors.neutral.gray700,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  policyText: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.xs,
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
  datesContainer: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  dateCard: {
    width: 70,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dateCardSelected: {
    backgroundColor: BrandColors.primary.orange + '10',
    borderColor: BrandColors.primary.orange,
  },
  dateTextSelected: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  dateLabel: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.xs,
  },
  dateLabelSelected: {
    color: BrandColors.primary.orange,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  timeSlotCard: {
    width: '30%',
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timeSlotCardSelected: {
    backgroundColor: BrandColors.primary.orange + '10',
    borderColor: BrandColors.primary.orange,
  },
  timeSlotTextSelected: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  countRow: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  countContainer: {
    flex: 1,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  countLabel: {
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
  packageCard: {
    width: 200,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
    marginRight: Spacing.base,
  },
  packageCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  packageName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  packageNameSelected: {
    color: BrandColors.primary.orange,
  },
  packagePrice: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  packageInclusions: {
    color: BrandColors.neutral.gray600,
  },
  emptyTables: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.base,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    color: BrandColors.neutral.gray500,
  },
  tablesGrid: {
    gap: Spacing.base,
  },
  tableCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
  },
  tableCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  tableInfo: {
    flex: 1,
  },
  tableName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  tableNameSelected: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  tableDetails: {
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
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
    backgroundColor: '#FFFFFF',
  },
});

