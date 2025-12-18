/**
 * Resort Booking Screen - Customer Mobile App
 * Book a room at a pet resort or boarding facility
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
import ResortService, { ResortRoom } from '../../services/ResortService';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { format, addDays } from 'date-fns';

interface ResortBookingScreenProps {
  route?: {
    params?: {
      vendorId: string;
      vendorName: string;
    };
  };
  navigation?: any;
}

export default function ResortBookingScreen({
  route,
  navigation,
}: ResortBookingScreenProps) {
  const vendorId = route?.params?.vendorId || '';
  const vendorName = route?.params?.vendorName || '';

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [rooms, setRooms] = useState<ResortRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ResortRoom | null>(null);
  const [checkInDate, setCheckInDate] = useState<Date>(addDays(new Date(), 1));
  const [checkOutDate, setCheckOutDate] = useState<Date>(addDays(new Date(), 2));
  const [guests, setGuests] = useState(1);
  const [selectedPets, setSelectedPets] = useState<Array<{ petId: string; petName: string }>>([]);
  const [specialRequest, setSpecialRequest] = useState('');
  const [nights, setNights] = useState(1);
  const [userPets, setUserPets] = useState<any[]>([]);

  useEffect(() => {
    loadResortData();
    loadUserPets();
  }, [vendorId]);

  useEffect(() => {
    if (checkInDate && checkOutDate) {
      const calculatedNights = ResortService.calculateNights(
        format(checkInDate, 'yyyy-MM-dd'),
        format(checkOutDate, 'yyyy-MM-dd')
      );
      setNights(calculatedNights);
    }
  }, [checkInDate, checkOutDate]);

  const loadResortData = async () => {
    try {
      setLoading(true);
      const resortRooms = await ResortService.getRooms(vendorId);
      setRooms(resortRooms);
    } catch (error) {
      console.error('Error loading resort data:', error);
      Alert.alert('Error', 'Failed to load resort information');
    } finally {
      setLoading(false);
    }
  };

  const loadUserPets = async () => {
    try {
      // TODO: Load user's pets from API
      // For now, placeholder
      setUserPets([]);
    } catch (error) {
      console.error('Error loading pets:', error);
    }
  };

  const handleBooking = async () => {
    if (!selectedRoom) {
      Alert.alert('Required', 'Please select a room');
      return;
    }

    if (checkInDate >= checkOutDate) {
      Alert.alert('Invalid Dates', 'Check-out date must be after check-in date');
      return;
    }

    if (selectedPets.length === 0) {
      Alert.alert('Required', 'Please select at least one pet');
      return;
    }

    try {
      setBooking(true);
      const result = await ResortService.createBooking(
        vendorId,
        selectedRoom.id,
        format(checkInDate, 'yyyy-MM-dd'),
        format(checkOutDate, 'yyyy-MM-dd'),
        guests,
        selectedPets,
        specialRequest
      );

      if (result) {
        Alert.alert(
          'Booking Requested',
          `Your ${nights}-night stay has been requested. The resort will confirm shortly.`,
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

  const togglePet = (pet: any) => {
    const isSelected = selectedPets.some((p) => p.petId === pet.id);
    if (isSelected) {
      setSelectedPets(selectedPets.filter((p) => p.petId !== pet.id));
    } else {
      setSelectedPets([...selectedPets, { petId: pet.id, petName: pet.name }]);
    }
  };

  const totalPrice = selectedRoom ? selectedRoom.price * nights : 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading resort information...
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
              Resort & Boarding
            </Text>
          </View>
        </View>

        {/* Room Selection */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Select Room</Text>
          {rooms.length === 0 ? (
            <View style={styles.emptyRooms}>
              <Icon name="hotel" size={48} color={BrandColors.neutral.gray300} />
              <Text style={[Typography.body, styles.emptyText]}>No rooms available</Text>
            </View>
          ) : (
            <View style={styles.roomsList}>
              {rooms.map((room) => {
                const isSelected = selectedRoom?.id === room.id;
                return (
                  <TouchableOpacity
                    key={room.id}
                    style={[styles.roomCard, isSelected && styles.roomCardSelected]}
                    onPress={() => setSelectedRoom(room)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.roomHeader}>
                      <View style={styles.roomInfo}>
                        <Text
                          style={[
                            Typography.h4,
                            styles.roomName,
                            isSelected && styles.roomNameSelected,
                          ]}
                        >
                          {room.name}
                        </Text>
                        <Text style={[Typography.bodySmall, styles.roomPrice]}>
                          ₹{room.price}/night
                        </Text>
                      </View>
                      <Icon
                        name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={24}
                        color={isSelected ? BrandColors.primary.orange : BrandColors.neutral.gray400}
                      />
                    </View>
                    {room.description && (
                      <Text style={[Typography.bodySmall, styles.roomDescription]}>
                        {room.description}
                      </Text>
                    )}
                    <View style={styles.roomDetails}>
                      <View style={styles.roomDetail}>
                        <Icon name="people" size={16} color={BrandColors.neutral.gray600} />
                        <Text style={[Typography.bodyTiny, styles.roomDetailText]}>
                          Max {room.maxOccupancy} guests
                        </Text>
                      </View>
                      {room.amenities && room.amenities.length > 0 && (
                        <View style={styles.amenitiesRow}>
                          {room.amenities.slice(0, 3).map((amenity, index) => (
                            <View key={index} style={styles.amenityBadge}>
                              <Text style={[Typography.bodyTiny, styles.amenityText]}>
                                {amenity}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Check-in & Check-out</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateContainer}>
              <Text style={[Typography.bodySmall, styles.dateLabel]}>Check-in</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  // TODO: Open date picker
                  Alert.alert('Date Picker', 'Select check-in date');
                }}
              >
                <Icon name="calendar-today" size={20} color={BrandColors.primary.orange} />
                <Text style={[Typography.body, styles.dateText]}>
                  {format(checkInDate, 'MMM d, yyyy')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateContainer}>
              <Text style={[Typography.bodySmall, styles.dateLabel]}>Check-out</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  // TODO: Open date picker
                  Alert.alert('Date Picker', 'Select check-out date');
                }}
              >
                <Icon name="calendar-today" size={20} color={BrandColors.primary.orange} />
                <Text style={[Typography.body, styles.dateText]}>
                  {format(checkOutDate, 'MMM d, yyyy')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.nightsContainer}>
            <Text style={[Typography.body, styles.nightsText]}>
              {nights} {nights === 1 ? 'night' : 'nights'}
            </Text>
          </View>
        </View>

        {/* Guest Count */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Number of Guests</Text>
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

        {/* Special Request */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Special Request (Optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Any special requests or requirements..."
            placeholderTextColor={BrandColors.neutral.gray400}
            value={specialRequest}
            onChangeText={setSpecialRequest}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Price Summary */}
        {selectedRoom && (
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={[Typography.body, styles.priceLabel]}>
                ₹{selectedRoom.price} × {nights} nights
              </Text>
              <Text style={[Typography.body, styles.priceValue]}>₹{totalPrice}</Text>
            </View>
            <View style={[styles.priceRow, styles.priceTotal]}>
              <Text style={[Typography.h4, styles.priceLabel]}>Total</Text>
              <Text style={[Typography.h4, styles.priceTotalValue]}>₹{totalPrice}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Book Button */}
      <View style={styles.footer}>
        <BrandedButton
          title={booking ? 'Booking...' : `Book for ₹${totalPrice}`}
          onPress={handleBooking}
          disabled={booking || !selectedRoom || selectedPets.length === 0}
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
  section: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  emptyRooms: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.base,
  },
  roomsList: {
    gap: Spacing.base,
  },
  roomCard: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
  },
  roomCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  roomNameSelected: {
    color: BrandColors.primary.orange,
  },
  roomPrice: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  roomDescription: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.sm,
  },
  roomDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    flexWrap: 'wrap',
  },
  roomDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  roomDetailText: {
    color: BrandColors.neutral.gray600,
  },
  amenitiesRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
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
  nightsContainer: {
    marginTop: Spacing.base,
    padding: Spacing.base,
    backgroundColor: BrandColors.primary.orange + '10',
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  nightsText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  countControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.base,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  countButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BrandColors.primary.orange + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countValue: {
    color: BrandColors.neutral.gray900,
    minWidth: 60,
    textAlign: 'center',
  },
  emptyPets: {
    padding: Spacing.base,
    alignItems: 'center',
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

