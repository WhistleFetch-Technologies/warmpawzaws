/**
 * Vet Service Router - Mobile
 * Handles vet service booking flow (clinic/home/video)
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
import { CustomerApi } from '../../services/api';

function formatSummaryDateTime(dateStr: string | null, timeStr: string | null): string {
  if (!dateStr || !timeStr) {
    return 'Not set';
  }
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return `${dateStr} at ${timeStr}`;
  }
  const dayPart = d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  return `${dayPart} at ${timeStr}`;
}

type ViewType = 
  | 'landing'
  | 'vet_center'
  | 'vet_home'
  | 'tele_consultation'
  | 'center_profile'
  | 'doctor_details'
  | 'select_service'
  | 'booking_details'
  | 'payment'
  | 'confirmation';

interface VetServiceRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  data?: any;
}

interface BookingFlow {
  serviceType: 'center' | 'home' | 'tele' | null;
  vendorId: string | null;
  vendorName: string | null;
  services: any[];
  pet: any | null;
  date: string | null;
  time: string | null;
  address: any | null;
  payment: any | null;
  booking: any | null;
  doctorId: string | null;
  selectedService: any | null;
}

export function VetServiceRouter({
  phone,
  onBack,
  onNavigate,
  onViewBooking,
  data,
}: VetServiceRouterProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState<string>('');
  const [pets, setPets] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [bookingNotes, setBookingNotes] = useState('');

  const [bookingFlow, setBookingFlow] = useState<BookingFlow>({
    serviceType: null,
    vendorId: null,
    vendorName: null,
    services: [],
    pet: null,
    date: null,
    time: null,
    address: null,
    payment: null,
    booking: null,
    doctorId: null,
    selectedService: null,
  });

  useEffect(() => {
    loadCustomerData();
  }, [phone]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);
      const customer = await CustomerApi.getCustomerByPhone(phone);
      if (customer) {
        setCustomerId(customer.id);
        const petsData = await CustomerApi.getPets(customer.id);
        setPets(petsData || []);
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
      Alert.alert('Error', 'Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceTypeSelect = (type: 'center' | 'home' | 'tele') => {
    setBookingFlow(prev => ({ ...prev, serviceType: type }));
    
    if (type === 'tele') {
      // Navigate to tele consultation booking
      setCurrentView('select_service');
    } else {
      // Load vendors for clinic/home visit
      loadVendors(type);
      setCurrentView('vet_center');
    }
  };

  const loadVendors = async (serviceType: 'center' | 'home') => {
    try {
      setLoading(true);
      const response = await CustomerApi.searchServices({
        serviceType: 'vet',
        serviceStyle: serviceType,
        location: '', // TODO: Get from location service
      });
      setVendors(response.vendors || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
      Alert.alert('Error', 'Failed to load veterinary clinics');
    } finally {
      setLoading(false);
    }
  };

  const handleVendorSelect = async (vendor: any) => {
    setSelectedVendor(vendor);
    setBookingFlow(prev => ({
      ...prev,
      vendorId: vendor.id,
      vendorName: vendor.name,
    }));

    try {
      setLoading(true);
      const vendorServices = await CustomerApi.getVendorServices(vendor.id);
      setServices(vendorServices || []);
      setCurrentView('select_service');
    } catch (error) {
      console.error('Error loading services:', error);
      Alert.alert('Error', 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (service: any) => {
    setBookingFlow(prev => ({
      ...prev,
      selectedService: service,
      services: [service],
    }));
    setCurrentView('booking_details');
  };

  const applySchedule = (date: string, time: string) => {
    setBookingFlow(prev => ({ ...prev, date, time }));
  };

  const applyAddress = (address: any) => {
    setBookingFlow(prev => ({ ...prev, address }));
  };

  const goToPaymentFromDetails = () => {
    if (!bookingFlow.pet) {
      Alert.alert('Select pet', 'Please choose a pet for this booking.');
      return;
    }
    if (!bookingFlow.date || !bookingFlow.time) {
      Alert.alert('Schedule', 'Please set date and time.');
      return;
    }
    if (bookingFlow.serviceType === 'home' && !bookingFlow.address) {
      Alert.alert('Address', 'Please confirm your home visit address.');
      return;
    }
    setCurrentView('payment');
  };

  const handlePayment = async (paymentData: any) => {
    try {
      setLoading(true);
      const booking = await CustomerApi.createBooking({
        vendorId: bookingFlow.vendorId!,
        serviceId: bookingFlow.selectedService!.id,
        petId: bookingFlow.pet!.id,
        date: bookingFlow.date!,
        time: bookingFlow.time!,
        address: bookingFlow.address,
        payment: paymentData,
        serviceType: bookingFlow.serviceType!,
      });

      setBookingFlow(prev => ({ ...prev, booking, payment: paymentData }));
      setCurrentView('confirmation');
    } catch (error) {
      console.error('Error creating booking:', error);
      Alert.alert('Error', 'Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderLanding = () => (
    <View style={styles.container}>
      <Text style={styles.title}>Veterinary Services</Text>
      <Text style={styles.subtitle}>Choose how you'd like to consult</Text>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => handleServiceTypeSelect('center')}
        >
          <Text style={styles.optionIcon}>🏥</Text>
          <Text style={styles.optionTitle}>Clinic Visit</Text>
          <Text style={styles.optionDescription}>
            Visit our veterinary clinic for in-person consultation
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => handleServiceTypeSelect('home')}
        >
          <Text style={styles.optionIcon}>🏠</Text>
          <Text style={styles.optionTitle}>Home Visit</Text>
          <Text style={styles.optionDescription}>
            Veterinarian visits your home for convenience
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => handleServiceTypeSelect('tele')}
        >
          <Text style={styles.optionIcon}>📹</Text>
          <Text style={styles.optionTitle}>Video Consultation</Text>
          <Text style={styles.optionDescription}>
            Consult with a vet via video call
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderVendorList = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('landing')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {bookingFlow.serviceType === 'center' ? 'Select Clinic' : 'Select Veterinarian'}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <ScrollView style={styles.vendorList}>
          {vendors.map((vendor) => (
            <TouchableOpacity
              key={vendor.id}
              style={styles.vendorCard}
              onPress={() => handleVendorSelect(vendor)}
            >
              <Text style={styles.vendorName}>{vendor.name}</Text>
              <Text style={styles.vendorAddress}>{vendor.address}</Text>
              {vendor.rating && (
                <Text style={styles.vendorRating}>
                  ⭐ {vendor.rating.toFixed(1)}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderServiceSelection = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('vet_center')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Service</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <ScrollView style={styles.serviceList}>
          {services.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={styles.serviceCard}
              onPress={() => handleServiceSelect(service)}
            >
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceDescription}>{service.description}</Text>
              <Text style={styles.servicePrice}>₹{service.price}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderBookingDetails = () => (
    <View style={styles.flexFill}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('select_service')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete booking</Text>
      </View>

      <ScrollView style={styles.petList} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionHeader}>Your pet</Text>
        {pets.length === 0 ? (
          <Text style={styles.infoText}>No pets on file.</Text>
        ) : (
          pets.map((pet) => (
            <TouchableOpacity
              key={pet.id}
              style={[
                styles.petCard,
                bookingFlow.pet?.id === pet.id && styles.petCardSelected,
              ]}
              onPress={() => setBookingFlow((prev) => ({ ...prev, pet }))}
            >
              <Text style={styles.petName}>{pet.name}</Text>
              <Text style={styles.petBreed}>{pet.breed}</Text>
              <Text style={styles.petAge}>{pet.age} years old</Text>
            </TouchableOpacity>
          ))
        )}

        <Text style={[styles.sectionHeader, styles.sectionSpacer]}>Date & time</Text>
        <Text style={styles.infoText}>Demo slot — replace with calendar when ready.</Text>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => applySchedule('2025-01-30', '10:00 AM')}
        >
          <Text style={styles.secondaryButtonText}>Use next available slot (demo)</Text>
        </TouchableOpacity>

        {bookingFlow.serviceType === 'home' && (
          <>
            <Text style={[styles.sectionHeader, styles.sectionSpacer]}>Visit address</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() =>
                applyAddress({
                  id: 'home-default',
                  label: 'Home',
                  address: selectedVendor?.address || 'Address on file',
                })
              }
            >
              <Text style={styles.secondaryButtonText}>Use default address</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={[styles.primaryButton, styles.sectionSpacer]} onPress={goToPaymentFromDetails}>
          <Text style={styles.primaryButtonText}>Continue to payment</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderPayment = () => {
    const svc = bookingFlow.selectedService;
    const durationMins =
      typeof svc?.duration === 'number'
        ? svc.duration
        : typeof svc?.durationMinutes === 'number'
          ? svc.durationMinutes
          : 15;
    const serviceTitle = svc?.name || 'Selected service';
    const price = svc?.price ?? 0;
    const pet = bookingFlow.pet;
    const petLine = pet
      ? `${pet.name}${pet.breed ? ` (${pet.breed})` : pet.type ? ` (${pet.type})` : ''}`
      : '—';

    return (
      <View style={[styles.container, styles.paymentRoot, styles.paymentScreenFill]}>
        <View style={styles.summaryHeader}>
          <TouchableOpacity
            onPress={() => setCurrentView('booking_details')}
            style={styles.headerBackTap}
            hitSlop={{ top: 16, bottom: 16, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.summaryBackGlyph} pointerEvents="none">
              ‹
            </Text>
          </TouchableOpacity>
          <Text style={styles.summaryHeaderTitle} numberOfLines={1}>
            Booking Summary
          </Text>
        </View>

        <ScrollView
          style={styles.paymentScroll}
          contentContainerStyle={styles.paymentScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryCardTop}>
              <View style={styles.summaryServiceIconWrap}>
                <Text style={styles.summaryServiceEmoji}>
                  {bookingFlow.serviceType === 'home' ? '🏠' : '🏥'}
                </Text>
              </View>
              <View style={styles.summaryServiceTextCol}>
                <Text style={styles.summaryServiceTitle} numberOfLines={3}>
                  {serviceTitle}
                </Text>
                <Text style={styles.summaryServiceMeta}>{durationMins} mins</Text>
              </View>
              <Text style={styles.summaryPrice}>₹{price}</Text>
            </View>

            <View style={styles.summaryDivider} />

            <Text style={styles.summaryRowLabel}>Date & Time</Text>
            <View style={styles.summaryRowInline}>
              <Text style={styles.summaryRowIcon}>📅</Text>
              <Text style={styles.summaryRowValue}>
                {formatSummaryDateTime(bookingFlow.date, bookingFlow.time)}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <Text style={styles.summaryRowLabel}>Pet</Text>
            <View style={styles.summaryRowInline}>
              <Text style={styles.summaryRowIcon}>👤</Text>
              <Text style={styles.summaryRowValue}>{petLine}</Text>
            </View>
          </View>

          <Text style={styles.notesSectionLabel}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Any symptoms or concerns..."
            placeholderTextColor={colors.textMuted}
            value={bookingNotes}
            onChangeText={setBookingNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </ScrollView>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            handlePayment({
              method: 'wallet',
              customerNotes: bookingNotes.trim() || undefined,
            })
          }
        >
          <Text style={styles.primaryButtonText}>Continue to Payment</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderConfirmation = () => (
    <View style={styles.container}>
      <View style={styles.confirmationContainer}>
        <Text style={styles.confirmationIcon}>✅</Text>
        <Text style={styles.confirmationTitle}>Booking Confirmed!</Text>
        <Text style={styles.confirmationMessage}>
          Your booking has been confirmed. Booking ID: {bookingFlow.booking?.id}
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            if (onViewBooking && bookingFlow.booking) {
              onViewBooking(bookingFlow.booking.id, bookingFlow.pet?.id || '');
            } else {
              onBack();
            }
          }}
        >
          <Text style={styles.primaryButtonText}>View Booking</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Back to Home</Text>
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
      {currentView === 'vet_center' && renderVendorList()}
      {currentView === 'select_service' && renderServiceSelection()}
      {currentView === 'booking_details' && renderBookingDetails()}
      {currentView === 'payment' && renderPayment()}
      {currentView === 'confirmation' && renderConfirmation()}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  /** Generous top padding after ScreenShell safe area — status bar / notch still overlaps on some devices without extra room. */
  paymentRoot: {
    paddingTop: spacing.xxl + spacing.xxl + spacing.lg,
  },
  paymentScreenFill: {
    flex: 1,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    marginBottom: spacing.md,
    width: '100%',
  },
  headerBackTap: {
    minWidth: 44,
    minHeight: 44,
    marginRight: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  /** Single left-pointing angle (U+2039) — reliable on all fonts; icon fonts can render blank without native linking. */
  summaryBackGlyph: {
    fontSize: 28,
    lineHeight: 32,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  /** Title on booking summary only — avoid flex:1 fighting the back control width. */
  summaryHeaderTitle: {
    flex: 1,
    flexShrink: 1,
    fontSize: typography.fontSizes['2xl'],
    fontWeight: '700',
    color: colors.text,
  },
  paymentScroll: {
    flex: 1,
  },
  paymentScrollContent: {
    paddingBottom: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  summaryServiceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: '#FFF4EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  summaryServiceEmoji: {
    fontSize: 22,
  },
  summaryServiceTextCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  summaryServiceTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  summaryServiceMeta: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  summaryPrice: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  summaryRowLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryRowIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  summaryRowValue: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  notesSectionLabel: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 100,
    fontSize: typography.body,
    color: colors.text,
    backgroundColor: colors.background,
  },
  backButton: {
    fontSize: typography.body,
    color: colors.primary,
    marginRight: spacing.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
  },
  title: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  optionsContainer: {
    gap: spacing.md,
  },
  optionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  optionIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  optionTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  optionDescription: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  vendorList: {
    flex: 1,
  },
  vendorCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  vendorName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  vendorAddress: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  vendorRating: {
    fontSize: typography.body,
    color: colors.primary,
  },
  serviceList: {
    flex: 1,
  },
  serviceCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  serviceName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  serviceDescription: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  servicePrice: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.primary,
  },
  flexFill: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionSpacer: {
    marginTop: spacing.lg,
  },
  petList: {
    flex: 1,
  },
  petCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  petCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: '#FFF7ED',
  },
  petName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  petBreed: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  petAge: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  infoText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
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
    marginBottom: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    width: '100%',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    width: '100%',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
});

