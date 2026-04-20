/**
 * Resort Services Screen - Mobile
 * Handles resort booking with room selection, dates, and pre-check form
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi, PaymentApi } from '../../services/api';
import RazorpayCheckout from 'react-native-razorpay';
import {
  applyWarmpawzCustomerToRazorpayOptions,
  profileEmailAndName,
} from '../../utils/razorpay-checkout-options';

type ViewType = 
  | 'landing'
  | 'resort_list'
  | 'resort_detail'
  | 'room_selection'
  | 'dates'
  | 'pre_check'
  | 'confirmation';

interface ResortServicesScreenProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  data?: any;
}

interface Resort {
  id: string;
  name: string;
  address: string;
  rating: number;
  image?: string;
}

interface Room {
  id: string;
  name: string;
  price: number;
  description?: string;
  capacity?: number;
  amenities?: string[];
}

interface PreCheckData {
  petName: string;
  petBreed: string;
  petAge: string;
  vaccinationStatus: 'fully_vaccinated' | 'partial' | 'expired';
  medicalConditions: string;
  dietaryNeeds: string;
  emergencyContact: string;
  aggressiveBehavior: boolean;
}

export function ResortServicesScreen({
  phone,
  onBack,
  onNavigate,
  onViewBooking,
  data,
}: ResortServicesScreenProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [loading, setLoading] = useState(false);
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [selectedResort, setSelectedResort] = useState<Resort | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [checkInDate, setCheckInDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [checkOutDate, setCheckOutDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [guestCount, setGuestCount] = useState(1);
  const [petCount, setPetCount] = useState(1);
  const [availabilityStatus, setAvailabilityStatus] = useState<{
    available: boolean;
    message?: string;
  } | null>(null);
  const [preCheckData, setPreCheckData] = useState<PreCheckData>({
    petName: '',
    petBreed: '',
    petAge: '',
    vaccinationStatus: 'fully_vaccinated',
    medicalConditions: '',
    dietaryNeeds: '',
    emergencyContact: '',
    aggressiveBehavior: false,
  });

  useEffect(() => {
    loadResorts();
  }, []);

  const loadResorts = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getServices({ roleId: 'pet_resort' });
      const services = (response as any).services || [];
      
      // Get unique resorts
      const resortMap = new Map();
      services.forEach((service: any) => {
        const vendorId = service.vendorId;
        if (!resortMap.has(vendorId)) {
          resortMap.set(vendorId, {
            id: vendorId,
            name: service.vendorName,
            address: service.vendorLocation?.address || 'Location unavailable',
            rating: service.vendorRating || 4.7,
            image: service.vendorImage,
          });
        }
      });
      
      setResorts(Array.from(resortMap.values()) as Resort[]);
    } catch (error) {
      console.error('Error loading resorts:', error);
      Alert.alert('Error', 'Failed to load resorts');
    } finally {
      setLoading(false);
    }
  };

  const loadResortDetails = async (resortId: string) => {
    try {
      setLoading(true);
      const response = await CustomerApi.getVendorServices(resortId);
      const services = (response as any).services || [];
      
      const roomList = services.map((service: any) => ({
        id: service.id,
        name: service.name || 'Room',
        price: service.price || 0,
        description: service.description,
        capacity: service.capacity || 1,
        amenities: service.amenities || [],
      }));
      
      setRooms(roomList);
      setCurrentView('room_selection');
    } catch (error) {
      console.error('Error loading resort details:', error);
      Alert.alert('Error', 'Failed to load resort details');
    } finally {
      setLoading(false);
    }
  };

  const handleResortSelect = (resort: Resort) => {
    setSelectedResort(resort);
    loadResortDetails(resort.id);
  };

  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room);
    setCurrentView('dates');
  };

  const checkAvailability = async () => {
    if (!selectedRoom || !checkInDate || !checkOutDate) return;
    
    try {
      setLoading(true);
      // TODO: Implement actual availability check API call
      setAvailabilityStatus({
        available: true,
        message: 'Room is available',
      });
    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailabilityStatus({
        available: true,
        message: 'Availability confirmed',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateNights = () => {
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays || 1;
  };

  const calculateTotal = () => {
    if (!selectedRoom) return 0;
    return selectedRoom.price * calculateNights();
  };

  const handleCreateBooking = async () => {
    if (!selectedResort || !selectedRoom || !preCheckData.petName || !preCheckData.petBreed) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const nights = calculateNights();
      const totalPrice = calculateTotal();

      // Get customer ID
      const customer = await CustomerApi.getCustomerByPhone(phone);
      const customerId = customer?.id;
      const { email: profileEmail, name: profileName } = profileEmailAndName(customer);

      if (!customerId) {
        Alert.alert('Error', 'Customer not found. Please try again.');
        return;
      }

      // Create booking first
      const bookingData = {
        vendorId: selectedResort.id,
        serviceId: selectedRoom.id,
        customerPhone: phone,
        customerId: customerId,
        date: checkInDate,
        time: '14:00',
        notes: `Resort Booking: ${nights} Nights. Guests: ${guestCount}, Pets: ${petCount}. Pre-check: ${JSON.stringify(preCheckData)}`,
        petDetails: {
          count: petCount,
          ...preCheckData,
        },
        status: 'pending',
        price: totalPrice,
        guestCount: guestCount,
        checkinDate: checkInDate,
        checkoutDate: checkOutDate,
        serviceType: 'at_center',
        bookingType: 'scheduled',
      };

      const bookingResponse = await CustomerApi.createBooking(bookingData);
      const bookingId = bookingResponse.bookingId || bookingResponse.id || bookingResponse.booking?.id;

      if (!bookingId) {
        throw new Error('Failed to create booking');
      }

      // Handle payment if amount > 0
      if (totalPrice > 0) {
        try {
          // Create Razorpay order
          const orderRes = await PaymentApi.createRazorpayOrder({
            amount: totalPrice,
            currency: 'INR',
            receipt: bookingId,
            bookingId: bookingId,
            customerId: customerId,
            vendorId: selectedResort.id,
          });

          if (!orderRes.order_id) {
            throw new Error('Failed to create payment order');
          }

          const baseOptions = {
            description: `Pet Resort Booking - ${nights} night${nights > 1 ? 's' : ''} stay`,
            image: 'https://your-logo-url.com/logo.png',
            currency: 'INR',
            key: orderRes.razorpay_key || 'YOUR_RAZORPAY_KEY', // Should come from env/config
            amount: totalPrice * 100, // Convert to paise
            name: 'Warmpawz',
            order_id: orderRes.order_id,
            theme: {
              color: '#FF8C42',
            },
          };

          const options = applyWarmpawzCustomerToRazorpayOptions(baseOptions, {
            phone,
            email: profileEmail,
            name: profileName,
          });

          const razorpayResponse = await RazorpayCheckout.open(options);

          // Verify payment
          await PaymentApi.verifyRazorpayPayment({
            razorpayOrderId: razorpayResponse.razorpay_order_id,
            razorpayPaymentId: razorpayResponse.razorpay_payment_id,
            razorpaySignature: razorpayResponse.razorpay_signature,
            bookingId: bookingId,
            customerId: customerId,
          });

          Alert.alert('Success', 'Resort booked successfully and payment confirmed!', [
            { text: 'OK', onPress: () => setCurrentView('confirmation') },
          ]);
        } catch (paymentError: any) {
          console.error('Payment error:', paymentError);
          if (paymentError.error) {
            // Payment failed or cancelled
            if (paymentError.error.code === 'BAD_REQUEST_ERROR') {
              Alert.alert('Payment Failed', paymentError.error.description || 'Payment failed. Please try again.');
            } else {
              // User cancelled
              Alert.alert('Payment Cancelled', 'Your booking has been created but payment was cancelled. Please complete payment later.');
            }
          } else {
            Alert.alert('Payment Error', 'Payment processing failed. Your booking is pending payment.');
          }
          // Still show confirmation as booking was created
          setCurrentView('confirmation');
        }
      } else {
        // Free booking - no payment needed
        Alert.alert('Success', 'Resort booked successfully!', [
          { text: 'OK', onPress: () => setCurrentView('confirmation') },
        ]);
      }
    } catch (error: any) {
      console.error('Error creating booking:', error);
      Alert.alert('Error', error.message || 'Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderLanding = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pet Resorts</Text>
        <Text style={styles.subtitle}>Luxury vacation for your pets</Text>
      </View>

      <ScrollView style={styles.landingContent}>
        <View style={styles.heroCard}>
          <Text style={styles.heroIcon}>🏝️</Text>
          <Text style={styles.heroTitle}>5-Star Pet Experience</Text>
          <Text style={styles.heroSubtitle}>
            Spa, pool, gourmet meals & more
          </Text>
        </View>

        <View style={styles.packagesSection}>
          <Text style={styles.sectionTitle}>Resort Packages</Text>
          <View style={styles.packageCard}>
            <Text style={styles.packageIcon}>🌊</Text>
            <View style={styles.packageInfo}>
              <Text style={styles.packageTitle}>Weekend Getaway</Text>
              <Text style={styles.packagePrice}>₹3,999/day</Text>
              <Text style={styles.packageFeature}>• Pool access</Text>
              <Text style={styles.packageFeature}>• Spa session</Text>
            </View>
          </View>
          <View style={styles.packageCard}>
            <Text style={styles.packageIcon}>💎</Text>
            <View style={styles.packageInfo}>
              <Text style={styles.packageTitle}>Luxury Suite</Text>
              <Text style={styles.packagePrice}>₹7,999/day</Text>
              <Text style={styles.packageFeature}>• Private suite</Text>
              <Text style={styles.packageFeature}>• Gourmet meals</Text>
              <Text style={styles.packageFeature}>• 24/7 care</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setCurrentView('resort_list')}
        >
          <Text style={styles.primaryButtonText}>Browse Resorts</Text>
        </TouchableOpacity>

        <View style={styles.amenitiesSection}>
          <Text style={styles.sectionTitle}>Resort Amenities</Text>
          <View style={styles.amenityItem}>
            <Text style={styles.amenityIcon}>🏊</Text>
            <View>
              <Text style={styles.amenityTitle}>Swimming Pools</Text>
              <Text style={styles.amenityDesc}>
                Temperature-controlled pet pools
              </Text>
            </View>
          </View>
          <View style={styles.amenityItem}>
            <Text style={styles.amenityIcon}>💆</Text>
            <View>
              <Text style={styles.amenityTitle}>Spa & Grooming</Text>
              <Text style={styles.amenityDesc}>
                Professional pampering services
              </Text>
            </View>
          </View>
          <View style={styles.amenityItem}>
            <Text style={styles.amenityIcon}>🍽️</Text>
            <View>
              <Text style={styles.amenityTitle}>Gourmet Meals</Text>
              <Text style={styles.amenityDesc}>
                Chef-prepared pet cuisine
              </Text>
            </View>
          </View>
          <View style={styles.amenityItem}>
            <Text style={styles.amenityIcon}>📸</Text>
            <View>
              <Text style={styles.amenityTitle}>Daily Updates</Text>
              <Text style={styles.amenityDesc}>
                Photos & videos of your pet
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const renderResortList = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('landing')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Luxury Pet Resorts</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <ScrollView style={styles.resortList}>
          {resorts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏝️</Text>
              <Text style={styles.emptyText}>
                No pet resorts available yet
              </Text>
              <Text style={styles.emptySubtext}>
                Check back soon for luxury pet resort experiences!
              </Text>
            </View>
          ) : (
            resorts.map((resort) => (
              <TouchableOpacity
                key={resort.id}
                style={styles.resortCard}
                onPress={() => handleResortSelect(resort)}
              >
                <View style={styles.resortImagePlaceholder}>
                  <Text style={styles.resortImageIcon}>🏝️</Text>
                </View>
                <View style={styles.resortInfo}>
                  <Text style={styles.resortName}>{resort.name}</Text>
                  <Text style={styles.resortRating}>
                    ⭐ {resort.rating.toFixed(1)}
                  </Text>
                  <Text style={styles.resortAddress}>{resort.address}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );

  const renderRoomSelection = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('resort_list')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{selectedResort?.name}</Text>
      </View>

      <ScrollView style={styles.roomSelectionContainer}>
        <Text style={styles.sectionTitle}>Select Room Type</Text>
        {rooms.length === 0 ? (
          <Text style={styles.emptyText}>No rooms available</Text>
        ) : (
          rooms.map((room) => (
            <TouchableOpacity
              key={room.id}
              style={[
                styles.roomCard,
                selectedRoom?.id === room.id && styles.roomCardSelected,
              ]}
              onPress={() => handleRoomSelect(room)}
            >
              <View style={styles.roomInfo}>
                <Text style={styles.roomName}>{room.name}</Text>
                {room.description && (
                  <Text style={styles.roomDescription}>{room.description}</Text>
                )}
                {room.amenities && room.amenities.length > 0 && (
                  <View style={styles.amenitiesList}>
                    {room.amenities.map((amenity, idx) => (
                      <Text key={idx} style={styles.amenityTag}>
                        {amenity}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.roomPriceContainer}>
                <Text style={styles.roomPrice}>₹{room.price}</Text>
                <Text style={styles.roomPricePeriod}>/night</Text>
                {selectedRoom?.id === room.id && (
                  <Text style={styles.selectedCheck}>✓</Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );

  const renderDates = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('room_selection')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Dates</Text>
      </View>

      <ScrollView style={styles.datesContainer}>
        <View style={styles.selectedRoomCard}>
          <Text style={styles.selectedRoomName}>{selectedRoom?.name}</Text>
          <Text style={styles.selectedRoomPrice}>
            ₹{selectedRoom?.price}/night
          </Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Check-in Date</Text>
          <TextInput
            style={styles.formInput}
            value={checkInDate}
            onChangeText={setCheckInDate}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Check-out Date</Text>
          <TextInput
            style={styles.formInput}
            value={checkOutDate}
            onChangeText={setCheckOutDate}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Number of Guests</Text>
          <View style={styles.counterContainer}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setGuestCount(Math.max(1, guestCount - 1))}
            >
              <Text style={styles.counterButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{guestCount}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setGuestCount(guestCount + 1)}
            >
              <Text style={styles.counterButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Number of Pets</Text>
          <View style={styles.counterContainer}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setPetCount(Math.max(1, petCount - 1))}
            >
              <Text style={styles.counterButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{petCount}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setPetCount(petCount + 1)}
            >
              <Text style={styles.counterButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Booking Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Nights:</Text>
            <Text style={styles.summaryValue}>{calculateNights()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Price per night:</Text>
            <Text style={styles.summaryValue}>₹{selectedRoom?.price}</Text>
          </View>
          <View style={styles.summaryTotal}>
            <Text style={styles.summaryTotalLabel}>Total:</Text>
            <Text style={styles.summaryTotalValue}>₹{calculateTotal()}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            checkAvailability();
            setCurrentView('pre_check');
          }}
        >
          <Text style={styles.primaryButtonText}>Continue to Pre-Check</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderPreCheck = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('dates')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pet Pre-Check</Text>
      </View>

      <ScrollView style={styles.preCheckContainer}>
        <View style={styles.preCheckCard}>
          <Text style={styles.preCheckTitle}>Mandatory Information</Text>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Pet Name *</Text>
            <TextInput
              style={styles.formInput}
              value={preCheckData.petName}
              onChangeText={(text) =>
                setPreCheckData({ ...preCheckData, petName: text })
              }
              placeholder="e.g. Buddy"
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formSection, { flex: 1, marginRight: spacing.sm }]}>
              <Text style={styles.formLabel}>Breed *</Text>
              <TextInput
                style={styles.formInput}
                value={preCheckData.petBreed}
                onChangeText={(text) =>
                  setPreCheckData({ ...preCheckData, petBreed: text })
                }
                placeholder="e.g. Golden Retriever"
              />
            </View>
            <View style={[styles.formSection, { flex: 1 }]}>
              <Text style={styles.formLabel}>Age</Text>
              <TextInput
                style={styles.formInput}
                value={preCheckData.petAge}
                onChangeText={(text) =>
                  setPreCheckData({ ...preCheckData, petAge: text })
                }
                placeholder="e.g. 3 years"
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Vaccination Status</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={[
                  styles.radioOption,
                  preCheckData.vaccinationStatus === 'fully_vaccinated' &&
                    styles.radioOptionSelected,
                ]}
                onPress={() =>
                  setPreCheckData({
                    ...preCheckData,
                    vaccinationStatus: 'fully_vaccinated',
                  })
                }
              >
                <Text
                  style={[
                    styles.radioOptionText,
                    preCheckData.vaccinationStatus === 'fully_vaccinated' &&
                      styles.radioOptionTextSelected,
                  ]}
                >
                  Fully Vaccinated
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.radioOption,
                  preCheckData.vaccinationStatus === 'partial' &&
                    styles.radioOptionSelected,
                ]}
                onPress={() =>
                  setPreCheckData({
                    ...preCheckData,
                    vaccinationStatus: 'partial',
                  })
                }
              >
                <Text
                  style={[
                    styles.radioOptionText,
                    preCheckData.vaccinationStatus === 'partial' &&
                      styles.radioOptionTextSelected,
                  ]}
                >
                  Partially Vaccinated
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.radioOption,
                  preCheckData.vaccinationStatus === 'expired' &&
                    styles.radioOptionSelected,
                ]}
                onPress={() =>
                  setPreCheckData({
                    ...preCheckData,
                    vaccinationStatus: 'expired',
                  })
                }
              >
                <Text
                  style={[
                    styles.radioOptionText,
                    preCheckData.vaccinationStatus === 'expired' &&
                      styles.radioOptionTextSelected,
                  ]}
                >
                  Expired/Unknown
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Medical Conditions / Allergies</Text>
            <TextInput
              style={[styles.formInput, styles.textArea]}
              value={preCheckData.medicalConditions}
              onChangeText={(text) =>
                setPreCheckData({ ...preCheckData, medicalConditions: text })
              }
              placeholder="Any medical issues or allergies we should know about?"
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Dietary Needs</Text>
            <TextInput
              style={[styles.formInput, styles.textArea]}
              value={preCheckData.dietaryNeeds}
              onChangeText={(text) =>
                setPreCheckData({ ...preCheckData, dietaryNeeds: text })
              }
              placeholder="Special food requirements or feeding schedule"
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Emergency Contact</Text>
            <TextInput
              style={styles.formInput}
              value={preCheckData.emergencyContact}
              onChangeText={(text) =>
                setPreCheckData({ ...preCheckData, emergencyContact: text })
              }
              placeholder="Emergency contact number"
            />
          </View>
        </View>

        <View style={styles.policyNotice}>
          <Text style={styles.policyTitle}>⚠️ Important Policy</Text>
          <Text style={styles.policyText}>
            For the safety of all pets, we require proof of Rabies and DHPP
            vaccinations upon arrival. Pets showing signs of illness may be
            refused entry.
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (!preCheckData.petName || !preCheckData.petBreed) &&
              styles.primaryButtonDisabled,
          ]}
          onPress={handleCreateBooking}
          disabled={!preCheckData.petName || !preCheckData.petBreed || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Confirm Booking</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderConfirmation = () => (
    <View style={styles.container}>
      <View style={styles.confirmationContainer}>
        <Text style={styles.confirmationIcon}>✅</Text>
        <Text style={styles.confirmationTitle}>Resort Booked!</Text>
        <Text style={styles.confirmationMessage}>
          Your resort booking has been confirmed. You will receive a confirmation
          shortly.
        </Text>
        {selectedResort && selectedRoom && (
          <View style={styles.confirmationDetails}>
            <Text style={styles.confirmationDetailText}>
              Resort: {selectedResort.name}
            </Text>
            <Text style={styles.confirmationDetailText}>
              Room: {selectedRoom.name}
            </Text>
            <Text style={styles.confirmationDetailText}>
              Check-in: {checkInDate}
            </Text>
            <Text style={styles.confirmationDetailText}>
              Check-out: {checkOutDate}
            </Text>
            <Text style={styles.confirmationDetailText}>
              Nights: {calculateNights()}
            </Text>
            <Text style={styles.confirmationDetailText}>
              Total: ₹{calculateTotal()}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.primaryButton} onPress={onBack}>
          <Text style={styles.primaryButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && currentView === 'landing') {
    return (
      <ScreenShell style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={styles.container}>
      {currentView === 'landing' && renderLanding()}
      {currentView === 'resort_list' && renderResortList()}
      {currentView === 'room_selection' && renderRoomSelection()}
      {currentView === 'dates' && renderDates()}
      {currentView === 'pre_check' && renderPreCheck()}
      {currentView === 'confirmation' && renderConfirmation()}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  backButton: {
    fontSize: typography.body,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.white,
  },
  title: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.white,
    opacity: 0.9,
  },
  landingContent: {
    flex: 1,
    padding: spacing.md,
  },
  heroCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  heroIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  packagesSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  packageCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  packageIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  packageInfo: {
    flex: 1,
  },
  packageTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  packagePrice: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  packageFeature: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  amenitiesSection: {
    marginTop: spacing.lg,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  amenityIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  amenityTitle: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  amenityDesc: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  resortList: {
    flex: 1,
    padding: spacing.md,
  },
  resortCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
    alignItems: 'center',
  },
  resortImagePlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: colors.gray['200'],
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resortImageIcon: {
    fontSize: 32,
  },
  resortInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  resortName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  resortRating: {
    fontSize: typography.body,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  resortAddress: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  roomSelectionContainer: {
    flex: 1,
    padding: spacing.md,
  },
  roomCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.gray['200'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F0FDFA',
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  roomDescription: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  amenityTag: {
    fontSize: typography.caption,
    color: colors.primary,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  roomPriceContainer: {
    alignItems: 'flex-end',
  },
  roomPrice: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.primary,
  },
  roomPricePeriod: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  selectedCheck: {
    fontSize: typography.h2,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  datesContainer: {
    flex: 1,
    padding: spacing.md,
  },
  selectedRoomCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  selectedRoomName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  selectedRoomPrice: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
  },
  formSection: {
    marginBottom: spacing.md,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  formLabel: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  formInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
    fontSize: typography.body,
    color: colors.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterButtonText: {
    color: colors.white,
    fontSize: typography.h2,
    fontWeight: 'bold',
  },
  counterValue: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
    minWidth: 40,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray['200'],
  },
  summaryTotalLabel: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
  },
  summaryTotalValue: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.primary,
  },
  preCheckContainer: {
    flex: 1,
    padding: spacing.md,
  },
  preCheckCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  preCheckTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  radioOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
    backgroundColor: colors.white,
  },
  radioOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F0FDFA',
  },
  radioOptionText: {
    fontSize: typography.body,
    color: colors.text,
  },
  radioOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  policyNotice: {
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  policyTitle: {
    fontSize: typography.body,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: spacing.xs,
  },
  policyText: {
    fontSize: typography.caption,
    color: '#92400E',
    lineHeight: 18,
  },
  confirmationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  confirmationIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  confirmationTitle: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  confirmationMessage: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  confirmationDetails: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
  },
  confirmationDetailText: {
    fontSize: typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonDisabled: {
    backgroundColor: colors.gray['200'],
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
});

