/**
 * Grooming Service Router - Mobile
 * Handles grooming service booking flow (center/home)
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
  | 'grooming_center'
  | 'grooming_home'
  | 'center_profile'
  | 'select_service'
  | 'select_pet'
  | 'select_time'
  | 'select_address'
  | 'payment'
  | 'confirmation';

interface GroomingServiceRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  data?: any;
}

interface BookingFlow {
  serviceType: 'center' | 'home' | null;
  vendorId: string | null;
  vendorName: string | null;
  services: any[];
  addOns: any[];
  pet: any | null;
  date: string | null;
  time: string | null;
  address: any | null;
  payment: any | null;
  booking: any | null;
}

export function GroomingServiceRouter({
  phone,
  onBack,
  onNavigate,
  onViewBooking,
  data,
}: GroomingServiceRouterProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState<string>('');
  const [pets, setPets] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);

  const [bookingFlow, setBookingFlow] = useState<BookingFlow>({
    serviceType: null,
    vendorId: null,
    vendorName: null,
    services: [],
    addOns: [],
    pet: null,
    date: null,
    time: null,
    address: null,
    payment: null,
    booking: null,
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

  const handleServiceTypeSelect = (type: 'center' | 'home') => {
    setBookingFlow(prev => ({ ...prev, serviceType: type }));
    loadVendors(type);
    setCurrentView(type === 'center' ? 'grooming_center' : 'grooming_home');
  };

  const loadVendors = async (serviceType: 'center' | 'home') => {
    try {
      setLoading(true);
      const response = await CustomerApi.searchServices({
        serviceType: 'grooming',
        serviceStyle: serviceType,
        location: '', // TODO: Get from location service
      });
      setVendors(response.vendors || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
      Alert.alert('Error', 'Failed to load grooming centers');
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
      
      // Load service packages if available
      if (vendorServices && vendorServices.length > 0) {
        const servicePackages = vendorServices.filter((s: any) => s.isPackage);
        setPackages(servicePackages);
      }
      
      setCurrentView('center_profile');
    } catch (error) {
      console.error('Error loading services:', error);
      Alert.alert('Error', 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleViewServices = () => {
    setCurrentView('select_service');
  };

  const handleServiceSelect = (service: any, addOns: any[] = []) => {
    setBookingFlow(prev => ({
      ...prev,
      services: [service],
      addOns: addOns || [],
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
        serviceId: bookingFlow.services[0]?.id,
        petId: bookingFlow.pet!.id,
        date: bookingFlow.date!,
        time: bookingFlow.time!,
        address: bookingFlow.address,
        payment: paymentData,
        serviceType: bookingFlow.serviceType!,
        addOns: bookingFlow.addOns,
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
      <Text style={styles.title}>Grooming Services</Text>
      <Text style={styles.subtitle}>Choose your preferred grooming option</Text>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => handleServiceTypeSelect('center')}
        >
          <Text style={styles.optionIcon}>✂️</Text>
          <Text style={styles.optionTitle}>Grooming Center</Text>
          <Text style={styles.optionDescription}>
            Visit our grooming center for professional pet grooming
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => handleServiceTypeSelect('home')}
        >
          <Text style={styles.optionIcon}>🏠</Text>
          <Text style={styles.optionTitle}>Home Grooming</Text>
          <Text style={styles.optionDescription}>
            Professional groomer visits your home for convenience
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
          {bookingFlow.serviceType === 'center' ? 'Select Grooming Center' : 'Select Groomer'}
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
              {vendor.distance && (
                <Text style={styles.vendorDistance}>
                  📍 {vendor.distance} km away
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderCenterProfile = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('grooming_center')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{selectedVendor?.name}</Text>
      </View>

      <ScrollView style={styles.profileContainer}>
        {selectedVendor?.image && (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imageText}>📷</Text>
          </View>
        )}
        
        <Text style={styles.profileAddress}>{selectedVendor?.address}</Text>
        
        {selectedVendor?.rating && (
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingText}>
              ⭐ {selectedVendor.rating.toFixed(1)} ({selectedVendor.reviewCount || 0} reviews)
            </Text>
          </View>
        )}

        {selectedVendor?.description && (
          <Text style={styles.description}>{selectedVendor.description}</Text>
        )}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleViewServices}
        >
          <Text style={styles.primaryButtonText}>View Services & Packages</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderServiceSelection = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('center_profile')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Service</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <ScrollView style={styles.serviceList}>
          {packages.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Service Packages</Text>
              {packages.map((pkg) => (
                <TouchableOpacity
                  key={pkg.id}
                  style={[styles.serviceCard, styles.packageCard]}
                  onPress={() => handleServiceSelect(pkg)}
                >
                  <Text style={styles.serviceName}>{pkg.name}</Text>
                  <Text style={styles.serviceDescription}>{pkg.description}</Text>
                  <Text style={styles.servicePrice}>₹{pkg.price}</Text>
                  <Text style={styles.packageBadge}>Package</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Individual Services</Text>
            {services.filter((s: any) => !s.isPackage).map((service) => (
              <TouchableOpacity
                key={service.id}
                style={styles.serviceCard}
                onPress={() => handleServiceSelect(service)}
              >
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.serviceDescription}>{service.description}</Text>
                <Text style={styles.servicePrice}>₹{service.price}</Text>
                {service.duration && (
                  <Text style={styles.serviceDuration}>⏱️ {service.duration} min</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
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

  const renderPayment = () => {
    const totalPrice = bookingFlow.services.reduce((sum, s) => sum + (s.price || 0), 0) +
                      bookingFlow.addOns.reduce((sum, a) => sum + (a.price || 0), 0);

    return (
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
            Service: {bookingFlow.services[0]?.name}
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
          {bookingFlow.addOns.length > 0 && (
            <Text style={styles.summaryItem}>
              Add-ons: {bookingFlow.addOns.length}
            </Text>
          )}
          <Text style={styles.summaryTotal}>
            Total: ₹{totalPrice}
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
  };

  const renderConfirmation = () => (
    <View style={styles.container}>
      <View style={styles.confirmationContainer}>
        <Text style={styles.confirmationIcon}>✅</Text>
        <Text style={styles.confirmationTitle}>Booking Confirmed!</Text>
        <Text style={styles.confirmationMessage}>
          Your grooming booking has been confirmed. Booking ID: {bookingFlow.booking?.id}
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
      {(currentView === 'grooming_center' || currentView === 'grooming_home') && renderVendorList()}
      {currentView === 'center_profile' && renderCenterProfile()}
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
    marginBottom: spacing.xs,
  },
  vendorDistance: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  profileContainer: {
    flex: 1,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: colors.gray.100,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  imageText: {
    fontSize: 48,
  },
  profileAddress: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  ratingContainer: {
    marginBottom: spacing.md,
  },
  ratingText: {
    fontSize: typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  description: {
    fontSize: typography.body,
    color: colors.text,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  serviceList: {
    flex: 1,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  serviceCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray.200,
  },
  packageCard: {
    borderColor: colors.primary,
    borderWidth: 2,
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
    marginTop: spacing.xs,
  },
  serviceDuration: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  packageBadge: {
    fontSize: typography.caption,
    color: colors.primary,
    fontWeight: 'bold',
    marginTop: spacing.xs,
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

