/**
 * Pet Cafe Services Screen - Mobile
 * Handles pet cafe listing and table reservation
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
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi, PaymentApi } from '../../services/api';
import RazorpayCheckout from 'react-native-razorpay';

type ViewType = 
  | 'landing'
  | 'cafe_list'
  | 'cafe_detail'
  | 'reservation'
  | 'confirmation';

interface PetCafeServicesScreenProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  data?: any;
}

interface Cafe {
  id: string;
  name: string;
  address: string;
  rating: number;
  image?: string;
}

interface TablePackage {
  id: string;
  name: string;
  price: number;
  description?: string;
}

export function PetCafeServicesScreen({
  phone,
  onBack,
  onNavigate,
  onViewBooking,
  data,
}: PetCafeServicesScreenProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [loading, setLoading] = useState(false);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [tables, setTables] = useState<TablePackage[]>([]);
  const [selectedTable, setSelectedTable] = useState<TablePackage | null>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState<string>('19:00');
  const [guestCount, setGuestCount] = useState(2);
  const [petCount, setPetCount] = useState(1);
  const [specialRequest, setSpecialRequest] = useState('');

  useEffect(() => {
    loadCafes();
  }, []);

  const loadCafes = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getServices({ roleId: 'pet_cafe' });
      const services = (response as any).services || [];
      
      // Get unique cafes
      const cafeMap = new Map();
      services.forEach((service: any) => {
        const vendorId = service.vendorId;
        if (!cafeMap.has(vendorId)) {
          cafeMap.set(vendorId, {
            id: vendorId,
            name: service.vendorName,
            address: service.vendorLocation?.address || 'Location unavailable',
            rating: service.vendorRating || 4.5,
            image: service.vendorImage || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000',
          });
        }
      });
      
      setCafes(Array.from(cafeMap.values()) as Cafe[]);
    } catch (error) {
      console.error('Error loading cafes:', error);
      Alert.alert('Error', 'Failed to load pet cafes');
    } finally {
      setLoading(false);
    }
  };

  const loadCafeDetails = async (cafeId: string) => {
    try {
      setLoading(true);
      const response = await CustomerApi.getServices({ vendorId: cafeId });
      const services = (response as any).services || [];
      
      // Services act as table packages
      const tablePackages = services.map((service: any) => ({
        id: service.id,
        name: service.name || 'Table Package',
        price: service.price || 0,
        description: service.description,
      }));
      
      setTables(tablePackages);
      setCurrentView('cafe_detail');
    } catch (error) {
      console.error('Error loading cafe details:', error);
      Alert.alert('Error', 'Failed to load cafe details');
    } finally {
      setLoading(false);
    }
  };

  const handleCafeSelect = (cafe: Cafe) => {
    setSelectedCafe(cafe);
    loadCafeDetails(cafe.id);
  };

  const handleReserve = () => {
    if (!selectedTable) {
      Alert.alert('Error', 'Please select a table package');
      return;
    }
    setCurrentView('reservation');
  };

  const handleCreateReservation = async () => {
    if (!selectedCafe || !selectedTable) {
      Alert.alert('Error', 'Please select cafe and table');
      return;
    }

    try {
      setLoading(true);
      const totalAmount = selectedTable.price || 0;

      // Get customer ID
      const customer = await CustomerApi.getCustomerByPhone(phone);
      const customerId = customer?.id;

      if (!customerId) {
        Alert.alert('Error', 'Customer not found. Please try again.');
        return;
      }

      // Create booking first
      const bookingData = {
        vendorId: selectedCafe.id,
        serviceId: selectedTable.id,
        customerPhone: phone,
        customerId: customerId,
        date: date,
        time: time,
        notes: `Cafe Reservation: ${guestCount} Pax, ${petCount} Pets. Note: ${specialRequest}`,
        petDetails: { count: petCount },
        status: 'pending',
        price: totalAmount,
        serviceType: 'at_center',
        bookingType: 'scheduled',
      };

      const bookingResponse = await CustomerApi.createBooking(bookingData);
      const bookingId = bookingResponse.bookingId || bookingResponse.id || bookingResponse.booking?.id;

      if (!bookingId) {
        throw new Error('Failed to create booking');
      }

      // Handle payment if amount > 0
      if (totalAmount > 0) {
        try {
          // Create Razorpay order
          const orderRes = await PaymentApi.createRazorpayOrder({
            amount: totalAmount,
            currency: 'INR',
            receipt: bookingId,
            bookingId: bookingId,
            customerId: customerId,
            vendorId: selectedCafe.id,
          });

          if (!orderRes.order_id) {
            throw new Error('Failed to create payment order');
          }

          // Open Razorpay checkout
          const options = {
            description: `Pet Cafe Table Reservation - ${selectedCafe.name}`,
            image: 'https://your-logo-url.com/logo.png',
            currency: 'INR',
            key: orderRes.razorpay_key || 'YOUR_RAZORPAY_KEY', // Should come from env/config
            amount: totalAmount * 100, // Convert to paise
            name: 'Warmpawz',
            order_id: orderRes.order_id,
            prefill: {
              contact: phone,
            },
            theme: {
              color: '#FF8C42',
            },
          };

          const razorpayResponse = await RazorpayCheckout.open(options);

          // Verify payment
          await PaymentApi.verifyRazorpayPayment({
            razorpayOrderId: razorpayResponse.razorpay_order_id,
            razorpayPaymentId: razorpayResponse.razorpay_payment_id,
            razorpaySignature: razorpayResponse.razorpay_signature,
            bookingId: bookingId,
            customerId: customerId,
          });

          Alert.alert('Success', 'Table reservation confirmed and payment successful!', [
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
        Alert.alert('Success', 'Table reservation requested!', [
          { text: 'OK', onPress: () => setCurrentView('confirmation') },
        ]);
      }
    } catch (error: any) {
      console.error('Error creating reservation:', error);
      Alert.alert('Error', error.message || 'Failed to create reservation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderLanding = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pet Cafes</Text>
        <Text style={styles.subtitle}>Dine with your furry friends</Text>
      </View>

      <ScrollView style={styles.landingContent}>
        <View style={styles.heroCard}>
          <Text style={styles.heroIcon}>☕</Text>
          <Text style={styles.heroTitle}>Pet-Friendly Dining</Text>
          <Text style={styles.heroSubtitle}>
            Special menus for pets & humans alike
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setCurrentView('cafe_list')}
          >
            <Text style={styles.primaryButtonText}>Browse Cafes</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{cafes.length}</Text>
            <Text style={styles.statLabel}>Pet Cafes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>⭐ 4.5</Text>
            <Text style={styles.statLabel}>Avg Rating</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const renderCafeList = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('landing')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Top Rated Cafes</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <ScrollView style={styles.cafeList}>
          {cafes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>☕</Text>
              <Text style={styles.emptyText}>No pet cafes available yet</Text>
              <Text style={styles.emptySubtext}>Check back soon!</Text>
            </View>
          ) : (
            cafes.map((cafe) => (
              <TouchableOpacity
                key={cafe.id}
                style={styles.cafeCard}
                onPress={() => handleCafeSelect(cafe)}
              >
                <View style={styles.cafeImagePlaceholder}>
                  <Text style={styles.cafeImageIcon}>☕</Text>
                </View>
                <View style={styles.cafeInfo}>
                  <View style={styles.cafeHeader}>
                    <Text style={styles.cafeName}>{cafe.name}</Text>
                    <Text style={styles.cafeRating}>
                      ⭐ {cafe.rating.toFixed(1)}
                    </Text>
                  </View>
                  <Text style={styles.cafeAddress}>{cafe.address}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );

  const renderCafeDetail = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('cafe_list')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{selectedCafe?.name}</Text>
      </View>

      <ScrollView style={styles.cafeDetailContainer}>
        <View style={styles.cafeDetailHeader}>
          <View style={styles.cafeImagePlaceholderLarge}>
            <Text style={styles.cafeImageIconLarge}>☕</Text>
          </View>
          <View style={styles.cafeDetailInfo}>
            <Text style={styles.cafeDetailName}>{selectedCafe?.name}</Text>
            <Text style={styles.cafeDetailRating}>
              ⭐ {selectedCafe?.rating.toFixed(1)} Rating
            </Text>
            <Text style={styles.cafeDetailAddress}>{selectedCafe?.address}</Text>
          </View>
        </View>

        <View style={styles.tablesSection}>
          <Text style={styles.sectionTitle}>Table Packages</Text>
          {tables.length === 0 ? (
            <Text style={styles.emptyText}>No table packages available</Text>
          ) : (
            tables.map((table) => (
              <TouchableOpacity
                key={table.id}
                style={[
                  styles.tableCard,
                  selectedTable?.id === table.id && styles.tableCardSelected,
                ]}
                onPress={() => setSelectedTable(table)}
              >
                <View style={styles.tableInfo}>
                  <Text style={styles.tableName}>{table.name}</Text>
                  {table.description && (
                    <Text style={styles.tableDescription}>{table.description}</Text>
                  )}
                </View>
                <View style={styles.tablePriceContainer}>
                  <Text style={styles.tablePrice}>₹{table.price}</Text>
                  {selectedTable?.id === table.id && (
                    <Text style={styles.selectedCheck}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            !selectedTable && styles.primaryButtonDisabled,
          ]}
          onPress={handleReserve}
          disabled={!selectedTable}
        >
          <Text style={styles.primaryButtonText}>Reserve Table</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderReservation = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('cafe_detail')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reservation Details</Text>
      </View>

      <ScrollView style={styles.reservationContainer}>
        <View style={styles.reservationCard}>
          <Text style={styles.reservationCardTitle}>Cafe</Text>
          <Text style={styles.reservationCardValue}>{selectedCafe?.name}</Text>
        </View>

        <View style={styles.reservationCard}>
          <Text style={styles.reservationCardTitle}>Table Package</Text>
          <Text style={styles.reservationCardValue}>{selectedTable?.name}</Text>
          <Text style={styles.reservationCardSubvalue}>
            ₹{selectedTable?.price}
          </Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Date</Text>
          <TextInput
            style={styles.formInput}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Time</Text>
          <TextInput
            style={styles.formInput}
            value={time}
            onChangeText={setTime}
            placeholder="HH:MM"
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

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Special Requests (Optional)</Text>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            value={specialRequest}
            onChangeText={setSpecialRequest}
            placeholder="Any special requirements..."
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleCreateReservation}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Confirm Reservation</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderConfirmation = () => (
    <View style={styles.container}>
      <View style={styles.confirmationContainer}>
        <Text style={styles.confirmationIcon}>✅</Text>
        <Text style={styles.confirmationTitle}>Reservation Requested!</Text>
        <Text style={styles.confirmationMessage}>
          Your table reservation has been submitted. The cafe will confirm shortly.
        </Text>
        {selectedCafe && (
          <View style={styles.confirmationDetails}>
            <Text style={styles.confirmationDetailText}>
              Cafe: {selectedCafe.name}
            </Text>
            <Text style={styles.confirmationDetailText}>
              Date: {date} at {time}
            </Text>
            <Text style={styles.confirmationDetailText}>
              Guests: {guestCount} | Pets: {petCount}
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
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {currentView === 'landing' && renderLanding()}
      {currentView === 'cafe_list' && renderCafeList()}
      {currentView === 'cafe_detail' && renderCafeDetail()}
      {currentView === 'reservation' && renderReservation()}
      {currentView === 'confirmation' && renderConfirmation()}
    </SafeAreaView>
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
    backgroundColor: colors.error + 20% opacity,
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
    marginBottom: spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray.200,
  },
  statNumber: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cafeList: {
    flex: 1,
    padding: spacing.md,
  },
  cafeCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray.200,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cafeImagePlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: colors.gray.200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cafeImageIcon: {
    fontSize: 32,
  },
  cafeInfo: {
    flex: 1,
    padding: spacing.md,
  },
  cafeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cafeName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
  },
  cafeRating: {
    fontSize: typography.body,
    color: colors.primary,
  },
  cafeAddress: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 24,
    color: colors.textSecondary,
    marginRight: spacing.md,
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
  },
  emptySubtext: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  cafeDetailContainer: {
    flex: 1,
    padding: spacing.md,
  },
  cafeDetailHeader: {
    marginBottom: spacing.lg,
  },
  cafeImagePlaceholderLarge: {
    width: '100%',
    height: 200,
    backgroundColor: colors.gray.200,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cafeImageIconLarge: {
    fontSize: 64,
  },
  cafeDetailInfo: {
    marginBottom: spacing.md,
  },
  cafeDetailName: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cafeDetailRating: {
    fontSize: typography.h3,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  cafeDetailAddress: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  tablesSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  tableCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.gray.200,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.error + 20% opacity,
  },
  tableInfo: {
    flex: 1,
  },
  tableName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  tableDescription: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  tablePriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tablePrice: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.primary,
  },
  selectedCheck: {
    fontSize: typography.h2,
    color: colors.primary,
  },
  reservationContainer: {
    flex: 1,
    padding: spacing.md,
  },
  reservationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reservationCardTitle: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  reservationCardValue: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
  },
  reservationCardSubvalue: {
    fontSize: typography.body,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  formSection: {
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
    borderColor: colors.gray.200,
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
    fontSize: typography.h2,
    color: colors.white,
    fontWeight: 'bold',
  },
  counterValue: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
    minWidth: 40,
    textAlign: 'center',
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
    backgroundColor: colors.gray.200,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
});

