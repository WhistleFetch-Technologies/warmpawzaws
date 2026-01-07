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
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

type ViewType = 
  | 'landing'
  | 'vet_center'
  | 'vet_home'
  | 'tele_consultation'
  | 'center_profile'
  | 'doctor_details'
  | 'select_service'
  | 'select_pet'
  | 'select_time'
  | 'select_address'
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
    setCurrentView('select_pet');
  };

  const handlePetSelect = (pet: any) => {
    setBookingFlow(prev => ({ ...prev, pet }));
    setCurrentView('select_time');
  };

  const handleTimeSelect = (date: string, time: string) => {
    setBookingFlow(prev => ({ ...prev, date, time }));
    
    if (bookingFlow.serviceType === 'home') {
      setCurrentView('select_address');
    } else {
      setCurrentView('payment');
    }
  };

  const handleAddressSelect = (address: any) => {
    setBookingFlow(prev => ({ ...prev, address }));
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

  const renderPetSelection = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('select_service')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Pet</Text>
      </View>

      <ScrollView style={styles.petList}>
        {pets.map((pet) => (
          <TouchableOpacity
            key={pet.id}
            style={styles.petCard}
            onPress={() => handlePetSelect(pet)}
          >
            <Text style={styles.petName}>{pet.name}</Text>
            <Text style={styles.petBreed}>{pet.breed}</Text>
            <Text style={styles.petAge}>{pet.age} years old</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderTimeSelection = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('select_pet')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Date & Time</Text>
      </View>

      <Text style={styles.infoText}>
        Time slot selection will be implemented with calendar component
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => handleTimeSelect('2025-01-30', '10:00 AM')}
      >
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAddressSelection = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('select_time')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Address</Text>
      </View>

      <Text style={styles.infoText}>
        Address selection will be implemented with location picker
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => handleAddressSelect({ address: 'Home Address' })}
      >
        <Text style={styles.primaryButtonText}>Use Default Address</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPayment = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            setCurrentView(
              bookingFlow.serviceType === 'home' ? 'select_address' : 'select_time'
            )
          }
        >
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
      </View>

      <View style={styles.bookingSummary}>
        <Text style={styles.summaryTitle}>Booking Summary</Text>
        <Text style={styles.summaryItem}>
          Service: {bookingFlow.selectedService?.name}
        </Text>
        <Text style={styles.summaryItem}>
          Pet: {bookingFlow.pet?.name}
        </Text>
        <Text style={styles.summaryItem}>
          Date: {bookingFlow.date}
        </Text>
        <Text style={styles.summaryItem}>
          Time: {bookingFlow.time}
        </Text>
        <Text style={styles.summaryTotal}>
          Total: ₹{bookingFlow.selectedService?.price || 0}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => handlePayment({ method: 'wallet' })}
      >
        <Text style={styles.primaryButtonText}>Pay with Wallet</Text>
      </TouchableOpacity>
    </View>
  );

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
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {currentView === 'landing' && renderLanding()}
      {currentView === 'vet_center' && renderVendorList()}
      {currentView === 'select_service' && renderServiceSelection()}
      {currentView === 'select_pet' && renderPetSelection()}
      {currentView === 'select_time' && renderTimeSelection()}
      {currentView === 'select_address' && renderAddressSelection()}
      {currentView === 'payment' && renderPayment()}
      {currentView === 'confirmation' && renderConfirmation()}
    </SafeAreaView>
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
  backButton: {
    fontSize: typography.body,
    color: colors.primary,
    marginRight: spacing.md,
  },
  headerTitle: {
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
    borderColor: colors.gray.200,
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
    borderColor: colors.gray.200,
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
    borderColor: colors.gray.200,
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
  petList: {
    flex: 1,
  },
  petCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray.200,
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
  bookingSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  summaryItem: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  summaryTotal: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: spacing.md,
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

