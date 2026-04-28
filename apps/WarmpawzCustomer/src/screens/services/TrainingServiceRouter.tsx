/**
 * Training Service Router - Mobile
 * Handles training service booking flow (center/home)
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
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';
import { formatDistanceDisplay } from '../../utils/distance-display';

type ViewType = 
  | 'landing'
  | 'training_center'
  | 'training_home'
  | 'center_profile'
  | 'select_service'
  | 'booking_details'
  | 'payment'
  | 'confirmation';

interface TrainingServiceRouterProps {
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

export function TrainingServiceRouter({
  phone,
  onBack,
  onNavigate,
  onViewBooking,
  data,
}: TrainingServiceRouterProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState<string>('');
  const [pets, setPets] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [userLocation] = useState<{ lat: number; lng: number }>({ lat: 12.9716, lng: 77.5946 });

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
    setCurrentView(type === 'center' ? 'training_center' : 'training_home');
  };

  const loadVendors = async (serviceType: 'center' | 'home') => {
    try {
      setLoading(true);
      const response = await CustomerApi.searchServices({
        serviceType: 'training',
        serviceStyle: serviceType,
        location: `${userLocation.lat},${userLocation.lng}`,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
      });
      setVendors(response.vendors || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
      Alert.alert('Error', 'Failed to load training centers');
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
      
      // ✅ FIX: Go directly to center_profile with services loaded
      // This allows service selection from the profile view like vet and grooming flows
      setCurrentView('center_profile');
    } catch (error) {
      console.error('Error loading services:', error);
      Alert.alert('Error', 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  // ✅ State for selected services in profile view
  const [selectedServicesInProfile, setSelectedServicesInProfile] = useState<string[]>([]);

  const toggleServiceInProfile = (serviceId: string) => {
    setSelectedServicesInProfile(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const getSelectedServicesTotal = () => {
    return services
      .filter(s => selectedServicesInProfile.includes(s.id))
      .reduce((sum, s) => sum + (s.price || 0), 0);
  };

  const handleBookFromProfile = () => {
    if (selectedServicesInProfile.length === 0) {
      Alert.alert('Please Select Services', 'Please select at least one training program to continue.');
      return;
    }
    
    const selectedServicesList = services.filter(s => selectedServicesInProfile.includes(s.id));
    setBookingFlow(prev => ({
      ...prev,
      services: selectedServicesList,
    }));
    setCurrentView('booking_details');
  };

  const handleServiceSelect = (service: any, addOns: any[] = []) => {
    setBookingFlow(prev => ({
      ...prev,
      services: [service],
      addOns: addOns || [],
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
      Alert.alert('Address', 'Please confirm your address for home training.');
      return;
    }
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
      <Text style={styles.title}>Pet Training Services</Text>
      <Text style={styles.subtitle}>Choose your preferred training option</Text>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => handleServiceTypeSelect('center')}
        >
          <Text style={styles.optionIcon}>🎓</Text>
          <Text style={styles.optionTitle}>Training Center</Text>
          <Text style={styles.optionDescription}>
            Visit our training center for structured pet training programs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => handleServiceTypeSelect('home')}
        >
          <Text style={styles.optionIcon}>🏠</Text>
          <Text style={styles.optionTitle}>Home Training</Text>
          <Text style={styles.optionDescription}>
            Professional trainer visits your home for personalized training
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
          {bookingFlow.serviceType === 'center' ? 'Select Training Center' : 'Select Trainer'}
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
              {formatDistanceDisplay(vendor) && (
                <Text style={styles.vendorDistance}>
                  📍 {formatDistanceDisplay(vendor)}
                </Text>
              )}
              {vendor.specializations && vendor.specializations.length > 0 && (
                <View style={styles.specializationsContainer}>
                  {vendor.specializations.slice(0, 3).map((spec: string, idx: number) => (
                    <Text key={idx} style={styles.specializationTag}>
                      {spec}
                    </Text>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  // ✅ FIX: Center Profile now shows services inline with selection checkboxes
  // This matches the vet and grooming flows where services are selected from profile before booking
  const renderCenterProfile = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView(bookingFlow.serviceType === 'center' ? 'training_center' : 'training_home')}>
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

        {selectedVendor?.specializations && selectedVendor.specializations.length > 0 && (
          <View style={styles.specializationsSection}>
            <Text style={styles.sectionTitle}>Specializations</Text>
            <View style={styles.specializationsContainer}>
              {selectedVendor.specializations.map((spec: string, idx: number) => (
                <Text key={idx} style={styles.specializationTag}>
                  {spec}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* ✅ Training Programs Section - Inline selection like VetCenterProfileView */}
        <View style={styles.servicesSection}>
          <Text style={styles.sectionHeader}>Select Training Programs</Text>
          
          {/* Selected count indicator */}
          {selectedServicesInProfile.length > 0 && (
            <View style={styles.selectedIndicator}>
              <Text style={styles.selectedIndicatorText}>
                {selectedServicesInProfile.length} program{selectedServicesInProfile.length > 1 ? 's' : ''} selected • ₹{getSelectedServicesTotal()}
              </Text>
            </View>
          )}
          
          {/* Training Packages */}
          {packages.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Training Packages</Text>
              {packages.map((pkg) => {
                const isSelected = selectedServicesInProfile.includes(pkg.id);
                return (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[styles.serviceCard, styles.packageCard, isSelected && styles.selectedServiceCard]}
                    onPress={() => toggleServiceInProfile(pkg.id)}
                  >
                    <View style={styles.serviceCardContent}>
                      <View style={styles.serviceInfo}>
                        <Text style={styles.serviceName}>{pkg.name}</Text>
                        <Text style={styles.serviceDescription}>{pkg.description}</Text>
                        {pkg.sessions && (
                          <Text style={styles.serviceSessions}>{pkg.sessions} sessions</Text>
                        )}
                        <Text style={styles.servicePrice}>₹{pkg.price}</Text>
                        <Text style={styles.packageBadge}>Package</Text>
                      </View>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Individual Sessions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Individual Sessions</Text>
            {services.filter((s: any) => !s.isPackage).map((service) => {
              const isSelected = selectedServicesInProfile.includes(service.id);
              return (
                <TouchableOpacity
                  key={service.id}
                  style={[styles.serviceCard, isSelected && styles.selectedServiceCard]}
                  onPress={() => toggleServiceInProfile(service.id)}
                >
                  <View style={styles.serviceCardContent}>
                    <View style={styles.serviceInfo}>
                      <Text style={styles.serviceName}>{service.name}</Text>
                      <Text style={styles.serviceDescription}>{service.description}</Text>
                      <Text style={styles.servicePrice}>₹{service.price}</Text>
                      {service.duration && (
                        <Text style={styles.serviceDuration}>⏱️ {service.duration} min</Text>
                      )}
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
      
      {/* ✅ Fixed bottom book button */}
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity
          style={[
            styles.primaryButton, 
            selectedServicesInProfile.length === 0 && styles.disabledButton
          ]}
          onPress={handleBookFromProfile}
          disabled={selectedServicesInProfile.length === 0}
        >
          <Text style={styles.primaryButtonText}>
            {selectedServicesInProfile.length === 0 
              ? 'Select Programs to Book' 
              : `Book ${selectedServicesInProfile.length} Program${selectedServicesInProfile.length > 1 ? 's' : ''} • ₹${getSelectedServicesTotal()}`
            }
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderServiceSelection = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('center_profile')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Training Program</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <ScrollView style={styles.serviceList}>
          {packages.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Training Packages</Text>
              {packages.map((pkg) => (
                <TouchableOpacity
                  key={pkg.id}
                  style={[styles.serviceCard, styles.packageCard]}
                  onPress={() => handleServiceSelect(pkg)}
                >
                  <Text style={styles.serviceName}>{pkg.name}</Text>
                  <Text style={styles.serviceDescription}>{pkg.description}</Text>
                  {pkg.sessions && (
                    <Text style={styles.serviceSessions}>
                      {pkg.sessions} sessions
                    </Text>
                  )}
                  <Text style={styles.servicePrice}>₹{pkg.price}</Text>
                  <Text style={styles.packageBadge}>Package</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Individual Sessions</Text>
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

  const renderBookingDetails = () => (
    <View style={styles.flexFill}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('center_profile')}>
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
            <Text style={[styles.sectionHeader, styles.sectionSpacer]}>Session address</Text>
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
    const totalPrice = bookingFlow.services.reduce((sum, s) => sum + (s.price || 0), 0) +
                      bookingFlow.addOns.reduce((sum, a) => sum + (a.price || 0), 0);

    return (
      <View style={styles.container}>
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

        <View style={styles.bookingSummary}>
          <Text style={styles.summaryItem}>Trainer: {bookingFlow.vendorName || selectedVendor?.name}</Text>
          {!!selectedVendor?.address && (
            <Text style={styles.summaryItem}>Location: {selectedVendor.address}</Text>
          )}
          <Text style={styles.summaryItem}>
            Program: {bookingFlow.services[0]?.name}
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
          Your training booking has been confirmed. Booking ID: {bookingFlow.booking?.id}
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
        <View style={styles.screenContentPad}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={styles.container}>
      <View style={styles.screenContentPad}>
        {currentView === 'landing' && renderLanding()}
        {(currentView === 'training_center' || currentView === 'training_home') && renderVendorList()}
        {currentView === 'center_profile' && renderCenterProfile()}
        {currentView === 'select_service' && renderServiceSelection()}
        {currentView === 'booking_details' && renderBookingDetails()}
        {currentView === 'payment' && renderPayment()}
        {currentView === 'confirmation' && renderConfirmation()}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  screenContentPad: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
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
  summaryBackGlyph: {
    fontSize: 28,
    lineHeight: 32,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  summaryHeaderTitle: {
    flex: 1,
    flexShrink: 1,
    fontSize: typography.fontSizes['2xl'],
    fontWeight: '700',
    color: colors.text,
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
    marginBottom: spacing.xs,
  },
  vendorDistance: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  specializationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  specializationTag: {
    fontSize: typography.caption,
    color: colors.primary,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  profileContainer: {
    flex: 1,
    paddingBottom: 100, // Space for fixed bottom button
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: colors.gray['100'],
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
  specializationsSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  serviceList: {
    flex: 1,
  },
  section: {
    marginBottom: spacing.xl,
  },
  serviceCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
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
  serviceSessions: {
    fontSize: typography.body,
    color: colors.primary,
    fontWeight: '600',
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
  // ✅ New styles for inline service selection
  servicesSection: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  selectedIndicator: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  selectedIndicatorText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
  serviceCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  serviceInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  selectedServiceCard: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: '#FFF7ED',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray['300'],
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray['200'],
  },
  disabledButton: {
    backgroundColor: colors.gray['300'],
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
  bookingSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
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

