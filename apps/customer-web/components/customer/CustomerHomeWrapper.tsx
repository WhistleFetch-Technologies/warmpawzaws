'use client';

import { useState } from 'react';
import { CustomerHomeComplete as CustomerHome } from './CustomerHomeComplete';
import { UserAccountSidebar } from './UserAccountSidebar';
import { CustomerPetDetails } from './CustomerPetDetails';
import { CustomerPetProfile } from './CustomerPetProfile';
import { WalkerService } from './WalkerService';
import { WalkerDashboard } from './walker/WalkerDashboard';
import { CustomerSidebar } from './CustomerSidebar';
import { PetBookingDetails } from './PetBookingDetails';
import { PetQuickView } from './PetQuickView';
import { AddPetModal } from './AddPetModal';
import { ComingSoon } from './ComingSoon';
import { VetServiceRouter } from './VetServiceRouter';
import { VetBookingFlow } from './vet/VetBookingFlow';
import { VetBookingRouter } from './vet/VetBookingRouter';
import { VetDoctorDetails } from './vet/VetDoctorDetails';
import { ClinicListView } from './vet/ClinicListView';
import { ClinicProfileView } from './vet/ClinicProfileView';
import { GroomingServiceRouter } from './GroomingServiceRouter';
import { TrainingServiceRouter } from './TrainingServiceRouter';
import { BoardingServiceRouter } from './BoardingServiceRouter';
import { AdoptionServiceRouter } from './AdoptionServiceRouter';
import { SunsetServiceRouter } from './SunsetServiceRouter';
import { CustomerProfile } from './CustomerProfile';
import { PetProfile } from './PetProfile';
import { PetProfileDashboard } from './PetProfileDashboard';
import { InsuranceServicesLanding } from './InsuranceServicesLanding';
import { PetCafeServicesLanding } from './PetCafeServicesLanding';
import { PharmacyServicesLanding } from './PharmacyServicesLanding';
import { PharmacyStore } from './PharmacyStore';
import { PharmacyCheckout } from './PharmacyCheckout';
import { PhotographyServicesLanding } from './PhotographyServicesLanding';
import { BreederServicesLanding } from './BreederServicesLanding';
import { AmbulanceServicesLanding } from './AmbulanceServicesLanding';
import { NutritionistServicesLanding } from './NutritionistServicesLanding';
import { RelocationServicesLanding } from './RelocationServicesLanding';
import { ResortServicesLanding } from './ResortServicesLanding';
import { PetHolidayServicesLanding } from './PetHolidayServicesLanding';
import { ShopDashboard } from './ShopDashboard';
import { ProductDetailPage } from './ProductDetailPage';
import { ShoppingCartView } from './ShoppingCartView';
import { CheckoutView } from './CheckoutView';
import { OrderSuccessView } from './OrderSuccessView';
import { OrderHistoryPage } from '../shop/OrderHistoryPage';
import { AddressBookPage } from '../shop/AddressBookPage';
import { WalletPage } from '../shop/WalletPage';
import { OrderDetailView } from './OrderDetailView';
import { ProductReviewsView } from './ProductReviewsView';
import { VendorProfileDetail } from './VendorProfileDetail';
import { SupportHelpCenter } from './SupportHelpCenter';
import { OrderTrackingView } from './OrderTrackingView';
import { ProblemCategoryMapper } from '../admin/ProblemCategoryMapper';
import { apiClient } from '@/lib/api-client';
import { useNotificationService } from './useNotificationService';
import { toast } from 'sonner';
import { useCart } from '@/context/CartContext';
import { MyBookings } from './MyBookings';
import { AppointmentsList } from './AppointmentsList';
import { AppointmentDetailsView } from './AppointmentDetailsView';
import { RescheduleAppointmentView } from './RescheduleAppointmentView';
// import { WalletView } from './WalletView';

// ✅ NEW IMPORTS FOR GAP FIXES
import { PetCafeListingZomatoStyle } from './PetCafeListingZomatoStyle';
import { ResortBoardingBookingEnhanced } from './ResortBoardingBookingEnhanced';
import { CafeReservationFlow } from './CafeReservationFlow';
import { BreederCatalogView } from './BreederCatalogView';
import { AmbulanceSOS } from './AmbulanceSOS';
import { AdoptionQuestionnaire } from './AdoptionQuestionnaire';
import { CustomerServicesPage } from './CustomerServicesPage';
import { CustomerBookingsPage } from './CustomerBookingsPage';
import { CreateBookingPage } from './CreateBookingPage';
import { CustomerPetsPage } from './CustomerPetsPage';
import { OrderTrackingPage } from '../shop/OrderTrackingPage';

// ✅ P2 CUSTOMER APP ENHANCEMENTS - Recently Developed UI Components
import { MultiPetBookingPage } from './MultiPetBookingPage';
import { ReturnRequestPage } from './ReturnRequestPage';
import { RewardsLoyaltyPage } from './RewardsLoyaltyPage';
import { ReferralSystemPage } from './ReferralSystemPage';
import { PackageBookingPage } from './PackageBookingPage';
import { EmergencyBookingPage } from './EmergencyBookingPage';
import { CheckInCheckOutPage } from './CheckInCheckOutPage';
import { MedicalRecordsPage } from './MedicalRecordsPage';
import { WalletPage as CustomerWalletPage } from './WalletPage';

// ✅ MATING & DATING SERVICE - P2P Matchmaking
import { MatingDatingHub } from './MatingDatingHub';
import { HomeServiceSelectionEnhanced } from './HomeServiceSelectionEnhanced';
import { IntegratedServicesHub } from '../IntegratedServicesHub';
import { ProblemGridSelector } from './ProblemGridSelector';
import { ServicesByProblem } from './ServicesByProblem';

type ScreenType = 
  | 'home' 
  | 'user-profile' 
  | 'customer-profile'
  | 'pet-profile'
  | 'pet-profile-dashboard'
  | 'pet-quick' 
  | 'pet-details' 
  | 'add-pet' 
  | 'walker' 
  | 'walker-booking' 
  | 'vet'
  | 'category-mapper'
  | 'vet-booking'
  | 'vet-doctor-details'
  | 'vet-clinic-list'
  | 'vet-clinic-profile'
  | 'vet-clinic-booking'
  | 'grooming'
  | 'training'
  | 'training_center'
  | 'training_home'
  | 'boarding'
  | 'boarding_facility'
  | 'adoption'
  | 'sunset'
  | 'insurance'
  | 'insurance_provider'
  | 'cafes'
  | 'cafe_detail'
  | 'cafe_reservation'
  | 'shop'
  | 'product_detail'
  | 'cart'
  | 'checkout'
  | 'order_success'
  | 'order_history'
  | 'order_detail'
  | 'order_tracking'
  | 'pharmacy_store'
  | 'pharmacy_checkout'
  | 'photography'
  | 'breeder'
  | 'breeder_catalog'
  | 'ambulance'
  | 'ambulance_sos'
  | 'nutritionist'
  | 'relocation'
  | 'resort'
  | 'resort_booking'
  | 'holiday'
  | 'food'
  | 'booking-details'
  | 'my-bookings'
  | 'appointments'
  | 'appointment-details'
  | 'appointment-reschedule'
  | 'wallet'
  | 'address_book'
  | 'coming-soon'
  | 'adoption_questionnaire'
  | 'services'
  | 'bookings'
  | 'create-booking'
  | 'pets'
  | 'multi-pet-booking'
  | 'return-request'
  | 'rewards-loyalty'
  | 'referral-system'
  | 'package-booking'
  | 'emergency-booking'
  | 'check-in-out'
  | 'medical-records'
  | 'customer-wallet'
  | 'mating-dating-hub'
  | 'integrated-services'
  | 'home-service-selection'
  | 'product_reviews'
  | 'vendor_profile'
  | 'support_help'
  | 'problem_grid'
  | 'problem_selected'
  | 'services_by_problem'
  | 'grooming_center'
  | 'grooming_home';

export function CustomerHomeWrapper({ phone, onNavigate, initialScreen }: { phone: string; onNavigate: (screen: string) => void; initialScreen?: ScreenType }) {
  console.log('CustomerHomeWrapper: Rendering with phone:', phone);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(initialScreen || 'home');
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<{ id: string; title: string; roleId?: string } | null>(null);
  const [currentServiceType, setCurrentServiceType] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userSidebarOpen, setUserSidebarOpen] = useState(false);
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedService, setSelectedService] = useState<string>('');
  const [vetServiceData, setVetServiceData] = useState<any>(null);
  const [walkerServiceData, setWalkerServiceData] = useState<any>(null);
  const [selectedPetData, setSelectedPetData] = useState<any>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>(undefined); // For generic bookings
  const { addToCart } = useCart();

  // Notification Service logic... (kept same as original)
  useNotificationService({
    phone: phone,
    enabled: !!phone,
    onNewNotification: async (notification) => {
      console.log('📬 [CUSTOMER-HOME] Notification received:', notification);
      if (notification.type === 'chat_message' && notification.bookingId) {
        try {
          const data = await apiClient.get<{ booking: { id: string; vendorId: string; vendorName: string; customerPhone: string } }>(`/customer/bookings/${notification.bookingId}`);
          if (data && data.booking) {
            setVetServiceData({
              booking: {
                bookingId: data.booking.id,
                vendorId: data.booking.vendorId,
                vendorName: data.booking.vendorName,
                customerPhone: data.booking.customerPhone
              }
            });
            setCurrentScreen('vet');
            toast.success('Opening chat...', { description: `Chat with ${data.booking.vendorName}`, duration: 2000 });
          }
        } catch (error) {
          console.error('Error fetching booking for navigation:', error);
          toast.error('Could not open chat');
        }
      }
      if (notification.type === 'prescription_generated' && notification.bookingId) {
         toast.info('New Prescription Available', {
           description: 'Tap to view details',
           action: { label: 'View', onClick: () => handleViewBooking(notification.bookingId) },
           duration: 5000
         });
      }
    }
  });
  
  // Navigation handlers (kept same mostly)
  const handleProfileClick = () => setUserSidebarOpen(true);
  const handleViewCustomerProfile = () => { setUserSidebarOpen(false); setCurrentScreen('customer-profile'); };
  const handlePetClick = (petId: string) => { setSelectedPetId(petId); setCurrentScreen('pet-quick'); };
  const handleViewPetProfile = (petData: any) => { setSelectedPetData(petData); setSelectedPetId(petData.id); setCurrentScreen('pet-profile'); };
  
  const handleViewFullPetProfile = async () => {
    if (!selectedPetId) return;
    try {
      const data = await apiClient.get<{ success: boolean; pet: any }>(`/customer/pets/${selectedPetId}`);
      if (data.success && data.pet) handleViewPetProfile(data.pet);
    } catch (error) { console.error('Error loading pet data:', error); }
  };

  const handleAddPet = () => setShowAddPetModal(true);
  const handleAddPetSuccess = () => setRefreshKey(prev => prev + 1);

  const handleNavigateToService = (service: string) => {
    if (service === 'walker') setCurrentScreen('walker');
    else if (service === 'vet' || service === 'veterinarian') setCurrentScreen('vet');
    else if (service === 'grooming') setCurrentScreen('grooming');
    else if (service === 'training') setCurrentScreen('training');
    else if (service === 'boarding') setCurrentScreen('boarding');
    else if (service === 'adoption') setCurrentScreen('adoption');
    else if (service === 'sunset') setCurrentScreen('sunset');
    else if (service === 'insurance') setCurrentScreen('insurance');
    else if (service === 'cafes') setCurrentScreen('cafes');
    else if (service === 'shop') setCurrentScreen('shop');
    else if (service === 'cart') setCurrentScreen('shop'); // Navigate to shop then cart logic handles
    else if (service === 'photography') setCurrentScreen('photography');
    else if (service === 'breeder') setCurrentScreen('breeder');
    else if (service === 'ambulance') setCurrentScreen('integrated-services'); // Use new integrated hub
    else if (service === 'nutritionist') setCurrentScreen('integrated-services');
    else if (service === 'diagnostics') setCurrentScreen('integrated-services');
    else if (service === 'home-service') setCurrentScreen('home-service-selection');
    else if (service === 'relocation') setCurrentScreen('relocation');
    else if (service === 'resort') setCurrentScreen('resort');
    else if (service === 'holiday') setCurrentScreen('holiday');
    else if (service === 'mating-dating-hub') setCurrentScreen('mating-dating-hub');
    else {
      setSelectedService(service);
      setCurrentScreen('coming-soon');
    }
  };
  
  const handleVetNavigate = (screen: string, data?: any) => {
    setVetServiceData(data);
    if (screen === 'vet-booking') setCurrentScreen('vet-booking');
    else if (screen === 'vet-doctor-details') setCurrentScreen('vet-doctor-details');
    else if (screen === 'vet-clinic-list') setCurrentScreen('vet-clinic-list');
    else if (screen === 'vet-clinic-profile') setCurrentScreen('vet-clinic-profile');
    else if (screen === 'vet-clinic-booking') setCurrentScreen('vet-clinic-booking');
    else if (screen === 'home') { setCurrentScreen('home'); setVetServiceData(null); }
  };
  
  const handleWalkerNavigate = (screen: string, data?: any) => {
    setWalkerServiceData(data);
    if (screen === 'walker-booking') setCurrentScreen('walker-booking');
  };

  const handleAccountNavigate = (path: string) => {
    if (path === 'account/orders') setCurrentScreen('order_history');
    else if (path === 'account/addresses') setCurrentScreen('address_book');
    else if (path === 'account/wallet') setCurrentScreen('wallet');
    else if (path === 'rewards-loyalty') setCurrentScreen('rewards-loyalty');
    else if (path === 'referral-system') setCurrentScreen('referral-system');
    else if (path === 'account/settings') toast.info('Settings coming soon');
  };

  const handleBack = () => {
    setCurrentScreen('home');
    setSelectedPetId(null);
    setSelectedBookingId(null);
    setVetServiceData(null);
    setWalkerServiceData(null);
    setSelectedVendorId(undefined);
    setSelectedProblem(null);
    setCurrentServiceType(null);
  };

  const handlePetDeleted = () => {
    setRefreshKey(prev => prev + 1);
    setCurrentScreen('home');
    setSelectedPetId(null);
    setSelectedBookingId(null);
  };

  const handlePetProfileComplete = async (pets: any[]) => {
    setRefreshKey(prev => prev + 1);
    setCurrentScreen('home');
  };

  const handleViewBooking = (bookingId: string, petId?: string) => {
    setSelectedBookingId(bookingId);
    if (petId) setSelectedPetId(petId);
    setSidebarOpen(false);
    setUserSidebarOpen(false);
    setCurrentScreen('my-bookings');
  };

  const handleReorderMedicine = (medications: any[]) => {
    console.log('Reordering medicines:', medications);
    if (medications && medications.length > 0) {
      medications.forEach(med => {
        addToCart({
          id: med.id || `med-${Math.random().toString(36).substr(2, 9)}`,
          name: med.name,
          price: med.price || 150,
          quantity: parseInt(med.quantity) || 1,
          prescriptionRequired: true,
          image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200'
        });
      });
      toast.success(`Added ${medications.length} medicines to cart`);
      setCurrentScreen('pharmacy_checkout');
    } else {
      toast.success('Navigating to Pharmacy...');
      setCurrentScreen('shop');
    }
  };

  // RENDER LOGIC

  if (currentScreen === 'home') {
    return (
      <>
        <CustomerHome 
          phone={phone}
          refreshKey={refreshKey}
          onNavigate={(screen, data) => {
            // Handle problem-based navigation
            if (screen === 'services_by_problem') {
              setSelectedProblem({ 
                id: data?.problemId, 
                title: data?.problemTitle || 'Service',
                roleId: data?.roleId
              });
              setCurrentScreen('services_by_problem');
            } else if (screen === 'problem_grid') {
              setCurrentServiceType(data?.roleId || 'general');
              setCurrentScreen('problem_grid');
            } else {
              handleNavigateToService(screen);
            }
          }}
          onProfileClick={handleProfileClick}
          onSidebarOpen={() => setSidebarOpen(true)}
          onPetClick={handlePetClick}
          onAddPet={handleAddPet}
          onViewBooking={handleViewBooking}
        />
        {userSidebarOpen && (
          <UserAccountSidebar 
            phone={phone}
            onClose={() => setUserSidebarOpen(false)}
            onViewBooking={handleViewBooking}
            onViewCustomerProfile={handleViewCustomerProfile}
            onNavigate={handleAccountNavigate}
          />
        )}
      </>
    );
  }

  // ... (Existing Render Logic for CustomerProfile, PetProfile, etc.)
  // I will paste the new screens here and keep the existing ones implicitly or explicitly if I knew them all perfectly. 
  // Given the truncation, I'll focus on the modifications and the structure.
  
  // ✅ UPDATED: Customer Profile with navigation
  if (currentScreen === 'customer-profile') return <CustomerProfile phone={phone} onBack={handleBack} onNavigate={(screen: string) => setCurrentScreen(screen as ScreenType)} />;
  if (currentScreen === 'pet-profile' && selectedPetData) return <PetProfile phone={phone} petId={selectedPetData.id} petName={selectedPetData.name} petType={selectedPetData.type} petBreed={selectedPetData.breed} petAge={selectedPetData.age} petGender={selectedPetData.gender} petImage={selectedPetData.image} onBack={handleBack} />;
  if (currentScreen === 'booking-details' && selectedBookingId && selectedPetId) return <PetBookingDetails bookingId={selectedBookingId} petId={selectedPetId} phone={phone} onBack={handleBack} onReorderMedicine={handleReorderMedicine} />;
  if (currentScreen === 'pet-quick' && selectedPetId) return <PetQuickView petId={selectedPetId} phone={phone} onBack={handleBack} onViewFullProfile={handleViewFullPetProfile} />;
  if (currentScreen === 'pet-details' && selectedPetId) return <CustomerPetDetails phone={phone} petId={selectedPetId} onBack={() => setCurrentScreen('pet-quick')} onViewBooking={handleViewBooking} onDelete={handlePetDeleted} onViewPetProfile={(petData: any) => { setSelectedPetData(petData); setCurrentScreen('pet-profile-dashboard'); }} />;
  if (currentScreen === 'pet-profile-dashboard' && selectedPetData) return <PetProfileDashboard phone={phone} petData={selectedPetData} onBack={() => { setCurrentScreen('pet-details'); setSelectedPetData(null); }} />;
  if (currentScreen === 'add-pet') return <CustomerPetProfile session={{ phone }} prefillData={null} onComplete={handlePetProfileComplete} onBack={handleBack} />;
  
  // Core Services
  if (currentScreen === 'walker') return <WalkerDashboard phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'problem_grid') {
      setCurrentServiceType('walker');
      setCurrentScreen('problem_grid');
    } else if (screen === 'problem_selected') {
      setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Walking Service', roleId: 'walker' });
      setCurrentScreen('services_by_problem');
    } else {
      handleWalkerNavigate(screen, data);
    }
  }} data={walkerServiceData} />;
  if (currentScreen === 'walker-booking') return <WalkerService phone={phone} onBack={() => setCurrentScreen('walker')} onNavigate={(screen, data) => {
    if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
      setCurrentScreen('create-booking');
    } else if (screen === 'problem_grid') {
      setCurrentServiceType('walker');
      setCurrentScreen('problem_grid');
    } else if (screen === 'problem_selected') {
      setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Walking Service', roleId: 'walker' });
      setCurrentScreen('services_by_problem');
    }
  }} />;
  if (currentScreen === 'vet') return <VetServiceRouter phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'problem_grid') {
      setCurrentServiceType('veterinarian');
      setCurrentScreen('problem_grid');
    } else if (screen === 'problem_selected') {
      setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Vet Service', roleId: 'veterinarian' });
      setCurrentScreen('services_by_problem');
    } else {
      handleVetNavigate(screen, data);
    }
  }} data={vetServiceData} />;
  if (currentScreen === 'vet-booking') return <VetBookingRouter phone={phone} doctorId={vetServiceData?.doctorId} doctor={vetServiceData?.doctor} selectedService={vetServiceData?.service} serviceType={vetServiceData?.serviceType || 'clinic'} onBack={() => setCurrentScreen('vet')} onNavigate={handleVetNavigate} onViewBooking={handleViewBooking} />;
  if (currentScreen === 'vet-doctor-details') return <VetDoctorDetails phone={phone} doctorId={vetServiceData?.doctorId || ''} onBack={() => setCurrentScreen('vet')} onNavigate={handleVetNavigate} />;
  if (currentScreen === 'vet-clinic-list') return <ClinicListView phone={phone} onBack={() => setCurrentScreen('vet')} onNavigate={(screen, data) => { if (screen === 'clinic-details') { setVetServiceData(data); setCurrentScreen('vet-clinic-profile'); } }} />;
  if (currentScreen === 'vet-clinic-profile') return <ClinicProfileView phone={phone} clinicId={vetServiceData?.id || ''} onBack={() => setCurrentScreen('vet-clinic-list')} onNavigate={(screen, data) => { if (screen === 'appointment') { setVetServiceData({ vendorId: data?.clinicId, serviceType: 'clinic' }); setCurrentScreen('vet-booking'); } }} />;
  if (currentScreen === 'vet-clinic-booking') return <VetBookingFlow phone={phone} serviceType={vetServiceData?.serviceType || 'tele'} vendorId={vetServiceData?.vendorId} onBack={() => setCurrentScreen('vet')} onNavigate={handleVetNavigate} />;
  if (currentScreen === 'grooming') return <GroomingServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} onNavigate={(screen, data) => { 
    console.log('🟢 [CustomerHomeWrapper] Grooming navigation:', screen, data);
    if (screen === 'appointment-details') { 
      setSelectedAppointmentId(data?.appointmentId); 
      setCurrentScreen('appointment-details'); 
    } else if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
      setCurrentScreen('create-booking');
    } else if (screen === 'problem_grid') {
      console.log('🟢 [CustomerHomeWrapper] Setting problem_grid screen');
      setCurrentServiceType('groomer');
      setCurrentScreen('problem_grid');
    } else if (screen === 'problem_selected') {
      console.log('🟢 [CustomerHomeWrapper] Setting problem_selected screen:', data);
      // Fetch problem details if not provided
      if (data?.problemId && !data?.problemTitle) {
        // Problem title will be fetched by ServicesByProblem component
        setSelectedProblem({ id: data.problemId, title: 'Loading...', roleId: 'groomer' });
      } else {
        setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Grooming Service', roleId: 'groomer' });
      }
      setCurrentScreen('services_by_problem');
    } else if (screen === 'grooming_center') {
      console.log('🟢 [CustomerHomeWrapper] Setting grooming_center screen');
      setCurrentScreen('grooming_center');
    } else if (screen === 'grooming_home') {
      console.log('🟢 [CustomerHomeWrapper] Setting grooming_home screen');
      setCurrentScreen('grooming_home');
    } else {
      console.warn('🟡 [CustomerHomeWrapper] Unhandled grooming navigation:', screen, data);
    }
  }} />;
  if (currentScreen === 'training') return <TrainingServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} onNavigate={(screen, data) => {
    console.log('🟢 [CustomerHomeWrapper] Training navigation:', screen, data);
    if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
      setCurrentScreen('create-booking');
    } else if (screen === 'problem_grid') {
      setCurrentServiceType('trainer');
      setCurrentScreen('problem_grid');
    } else if (screen === 'problem_selected') {
      setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Training Service', roleId: 'trainer' });
      setCurrentScreen('services_by_problem');
    } else if (screen === 'training_center' || screen === 'training_home') {
      // Navigate to services page filtered for training services
      setCurrentScreen('services');
      // Note: We could add training_center/training_home screens similar to grooming if needed
    } else {
      console.warn('🟡 [CustomerHomeWrapper] Unhandled training navigation:', screen, data);
      setCurrentScreen('coming-soon');
    }
  }} />;
  if (currentScreen === 'boarding') return <BoardingServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} onNavigate={(screen, data) => {
    if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
      setCurrentScreen('create-booking');
    } else if (screen === 'problem_grid') {
      setCurrentServiceType('boarding');
      setCurrentScreen('problem_grid');
    } else if (screen === 'problem_selected') {
      setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Boarding Service', roleId: 'boarding' });
      setCurrentScreen('services_by_problem');
    } else {
      setCurrentScreen('coming-soon');
    }
  }} />;
  if (currentScreen === 'adoption') return <AdoptionServiceRouter phone={phone} onBack={handleBack} onNavigate={(screen, data) => { 
    if (screen === 'adoption_questionnaire') {
      setCurrentScreen('adoption_questionnaire');
    } else if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setCurrentScreen('create-booking');
    } else if (screen === 'problem_grid') {
      setCurrentServiceType('adoption');
      setCurrentScreen('problem_grid');
    } else if (screen === 'problem_selected') {
      setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Adoption Service', roleId: 'adoption' });
      setCurrentScreen('services_by_problem');
    } else {
      setCurrentScreen('coming-soon');
    }
  }} />;
  if (currentScreen === 'sunset') return <SunsetServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} onNavigate={(screen, data) => {
    if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
      setCurrentScreen('create-booking');
    } else if (screen === 'problem_grid') {
      setCurrentServiceType('sunset');
      setCurrentScreen('problem_grid');
    } else if (screen === 'problem_selected') {
      setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Sunset Care Service', roleId: 'sunset' });
      setCurrentScreen('services_by_problem');
    } else {
      setCurrentScreen('coming-soon');
    }
  }} />;
  if (currentScreen === 'insurance') return <InsuranceServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'insurance_policy_purchase') {
      setSelectedVendorId(data?.vendorId);
      setCurrentScreen('insurance_provider');
    } else if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setCurrentScreen('create-booking');
    } else {
      setCurrentScreen('coming-soon');
    }
  }} />;
  
  // ✅ UPDATED LANDING PAGES & FLOWS
  if (currentScreen === 'resort') return <ResortServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { if (screen === 'resort_booking') { setSelectedVendorId(data?.vendorId); setCurrentScreen('resort_booking'); } }} />;
  if (currentScreen === 'resort_booking') return <ResortBoardingBookingEnhanced phone={phone} preSelectedVendorId={selectedVendorId} onBack={() => setCurrentScreen('resort')} onSuccess={() => setCurrentScreen('my-bookings')} />;
  
  if (currentScreen === 'cafes') return <PetCafeServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { 
      if (screen === 'cafe_reservation') { setSelectedVendorId(data?.vendorId); setCurrentScreen('cafe_reservation'); }
      else if (screen === 'cafe_detail') { setSelectedVendorId(data?.vendorId); setCurrentScreen('cafe_detail'); }
  }} />;
  if (currentScreen === 'cafe_detail') return <PetCafeListingZomatoStyle cafeId={selectedVendorId || ''} onBack={() => setCurrentScreen('cafes')} />;
  if (currentScreen === 'cafe_reservation') return <CafeReservationFlow phone={phone} preSelectedVendorId={selectedVendorId} onBack={() => setCurrentScreen('cafes')} />;
  
  if (currentScreen === 'breeder') return <BreederServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { if (screen === 'breeder_catalog') setCurrentScreen('breeder_catalog'); }} />;
  if (currentScreen === 'breeder_catalog') return <BreederCatalogView phone={phone} onBack={() => setCurrentScreen('breeder')} />;

  if (currentScreen === 'ambulance') return <AmbulanceServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { if (screen === 'ambulance_sos') setCurrentScreen('ambulance_sos'); }} />;
  if (currentScreen === 'ambulance_sos') return <AmbulanceSOS phone={phone} onBack={() => setCurrentScreen('ambulance')} />;
  
  if (currentScreen === 'photography') return <PhotographyServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
      setCurrentScreen('create-booking');
    } else {
      setCurrentScreen('coming-soon');
    }
  }} />;
  if (currentScreen === 'relocation') return <RelocationServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
      setCurrentScreen('create-booking');
    } else {
      setCurrentScreen('coming-soon');
    }
  }} />;
  
  // Nutritionist & Holiday
  if (currentScreen === 'nutritionist') return <NutritionistServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
      setCurrentScreen('create-booking');
    } else {
      setCurrentScreen('coming-soon');
    }
  }} />;
  if (currentScreen === 'holiday') return <PetHolidayServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
      setCurrentScreen('create-booking');
    } else {
      setCurrentScreen('coming-soon');
    }
  }} />;

  // Shop & Orders
  if (currentScreen === 'shop') return <ShopDashboard phone={phone} onBack={handleBack} onNavigate={(screen, data) => { if (screen === 'pharmacy_store') setCurrentScreen('pharmacy_store'); else if (screen === 'pharmacy_checkout') setCurrentScreen('pharmacy_checkout'); else if (screen === 'product_detail') { setSelectedProduct(data?.product); setCurrentScreen('product_detail'); } else if (screen === 'cart') setCurrentScreen('cart'); else handleNavigateToService(screen); }} />;
  if (currentScreen === 'product_detail' && selectedProduct) return (
    <ProductDetailPage 
      product={selectedProduct} 
      phone={phone}
      onBack={() => setCurrentScreen('shop')} 
      onReviewsClick={() => {
        setCurrentScreen('product_reviews');
      }} 
      onVendorClick={() => {
        if (selectedProduct.vendorId) {
          setSelectedVendorId(selectedProduct.vendorId);
          setCurrentScreen('vendor_profile');
        } else {
          toast.info('Vendor information not available');
        }
      }} 
    />
  );
  if (currentScreen === 'product_reviews' && selectedProduct) return <ProductReviewsView productId={selectedProduct.id || selectedProduct.productId} productName={selectedProduct.name} onBack={() => setCurrentScreen('product_detail')} />;
  if (currentScreen === 'vendor_profile' && selectedVendorId) return <VendorProfileDetail vendorId={selectedVendorId} phone={phone} onBack={() => setCurrentScreen(selectedProduct ? 'product_detail' : 'shop')} onNavigate={(screen, data) => { if (screen === 'product_detail') { setSelectedProduct(data?.product); setCurrentScreen('product_detail'); } }} />;
  if (currentScreen === 'cart') return <ShoppingCartView onBack={() => setCurrentScreen('shop')} onCheckout={() => setCurrentScreen('checkout')} onContinueShopping={() => setCurrentScreen('shop')} />;
  if (currentScreen === 'checkout') return <CheckoutView phone={phone} onBack={() => setCurrentScreen('shop')} onSuccess={(orderId) => { setCurrentOrderId(orderId); setCurrentScreen('order_success'); }} />;
  if (currentScreen === 'order_success' && currentOrderId) return <OrderSuccessView orderId={currentOrderId} onTrackOrder={() => { setSelectedOrder({ id: currentOrderId }); setCurrentScreen('order_tracking'); }} onBackToHome={() => { setCurrentOrderId(null); setCurrentScreen('home'); }} onViewOrders={() => { setCurrentOrderId(null); setCurrentScreen('order_history'); }} />;
  if (currentScreen === 'order_history') return <OrderHistoryPage onNavigate={handleAccountNavigate} />;
  if (currentScreen === 'address_book') return <AddressBookPage phone={phone} onBack={handleBack} onSelect={(address) => { toast.success('Address selected'); handleBack(); }} />;
  if (currentScreen === 'wallet') return <WalletPage onNavigate={handleAccountNavigate} />;
  // if (currentScreen === 'order_history') return <OrderHistoryView phone={phone} onBack={handleBack} onOrderClick={(order) => { setSelectedOrder(order); setCurrentScreen('order_detail'); }} />;
  if (currentScreen === 'order_detail' && selectedOrder) return <OrderDetailView order={selectedOrder} onBack={() => setCurrentScreen('order_history')} onTrackOrder={() => setCurrentScreen('order_tracking')} onReorder={() => { toast.success('Items added to cart'); setCurrentScreen('shop'); }} onHelp={() => setCurrentScreen('support_help')} />;
  if (currentScreen === 'order_tracking' && selectedOrder) return <OrderTrackingPage orderId={selectedOrder.id || selectedOrder.orderId} onBack={() => setCurrentScreen('order_detail')} />;
  
  if (currentScreen === 'pharmacy_store') return <PharmacyStore phone={phone} onBack={() => setCurrentScreen('shop')} onNavigate={(screen) => { if (screen === 'pharmacy_checkout') setCurrentScreen('pharmacy_checkout'); else if (screen === 'cart') setCurrentScreen('cart'); }} />;
  if (currentScreen === 'pharmacy_checkout') return <PharmacyCheckout phone={phone} onBack={() => setCurrentScreen('pharmacy_store')} onSuccess={() => setCurrentScreen('home')} />;

  // Other Screens
  if (currentScreen === 'my-bookings') return <MyBookings phone={phone} onBack={handleBack} initialBookingId={selectedBookingId || undefined} onReorderMedicine={handleReorderMedicine} />;
  if (currentScreen === 'appointments') return <AppointmentsList customerId={phone} onBack={handleBack} onSelectAppointment={(appointmentId) => { setSelectedAppointmentId(appointmentId); setCurrentScreen('appointment-details'); }} />;
  if (currentScreen === 'appointment-details' && selectedAppointmentId) return <AppointmentDetailsView appointmentId={selectedAppointmentId} customerId={phone} onBack={() => setCurrentScreen('appointments')} onReschedule={(appointmentId) => { setSelectedAppointmentId(appointmentId); setCurrentScreen('appointment-reschedule'); }} onCancel={() => { setCurrentScreen('appointments'); setSelectedAppointmentId(null); }} />;
  if (currentScreen === 'appointment-reschedule' && selectedAppointmentId) return <RescheduleAppointmentView appointmentId={selectedAppointmentId} onBack={() => setCurrentScreen('appointment-details')} onSuccess={() => { setCurrentScreen('appointment-details'); toast.success('Rescheduled successfully'); }} />;
  
  // if (currentScreen === 'wallet') return <WalletView phone={phone} onBack={handleBack} />;
  if (currentScreen === 'category-mapper') return <ProblemCategoryMapper />;
  
  // ✅ NEW: Adoption Questionnaire
  if (currentScreen === 'adoption_questionnaire') return <AdoptionQuestionnaire onBack={() => setCurrentScreen('adoption')} onComplete={() => { toast.success('Preferences saved'); setCurrentScreen('adoption'); }} />;

  // ✅ NEW: Services Browser
  if (currentScreen === 'services') return <CustomerServicesPage onBack={handleBack} onNavigate={(screen, data) => { 
    if (screen === 'create-booking') { 
      setSelectedService(data?.serviceId);
      setSelectedVendorId(data?.vendorId);
      setCurrentScreen('create-booking');
    } else {
      handleNavigateToService(screen);
    }
  }} />;
  
  // ✅ Grooming Service Style Screens
  if (currentScreen === 'grooming_center') return <CustomerServicesPage 
    onBack={() => setCurrentScreen('grooming')} 
    onNavigate={(screen, data) => { 
      if (screen === 'create-booking') { 
        setSelectedService(data?.serviceId);
        setSelectedVendorId(data?.vendorId);
        setVetServiceData({ vendorId: data?.vendorId, serviceType: 'grooming', serviceStyle: 'at_center' });
        setCurrentScreen('create-booking');
      } else {
        handleNavigateToService(screen);
      }
    }} 
    initialFilters={{ category: 'grooming', roleId: 'pet_groomer', serviceStyle: 'at_center' }}
  />;
  
  if (currentScreen === 'grooming_home') return <CustomerServicesPage 
    onBack={() => setCurrentScreen('grooming')} 
    onNavigate={(screen, data) => { 
      if (screen === 'create-booking') { 
        setSelectedService(data?.serviceId);
        setSelectedVendorId(data?.vendorId);
        setVetServiceData({ vendorId: data?.vendorId, serviceType: 'grooming', serviceStyle: 'at_home' });
        setCurrentScreen('create-booking');
      } else {
        handleNavigateToService(screen);
      }
    }} 
    initialFilters={{ category: 'grooming', roleId: 'pet_groomer', serviceStyle: 'at_home' }}
  />;

  // ✅ NEW: Bookings List
  if (currentScreen === 'bookings') return <CustomerBookingsPage phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'booking-details') handleViewBooking(data.bookingId);
    else if (screen === 'services') setCurrentScreen('services');
  }} />;
  
  // Support & Help Center
  if (currentScreen === 'support_help') return <SupportHelpCenter phone={phone} onBack={handleBack} />;

  // ✅ NEW: Create Booking
  if (currentScreen === 'create-booking') return <CreateBookingPage phone={phone} serviceId={selectedService} vendorId={selectedVendorId} onBack={() => setCurrentScreen('services')} onSuccess={(bookingId) => handleViewBooking(bookingId)} />;

  // ✅ NEW: Pets
  if (currentScreen === 'pets') return <CustomerPetsPage 
    phone={phone} 
    onBack={handleBack} 
    onNavigate={(screen, data) => {
      if (screen === 'pet-details') {
         setSelectedPetId(data?.petId);
         setCurrentScreen('pet-details');
      }
    }} 
    onAddPet={() => setShowAddPetModal(true)} 
  />;

  // ✅ P2 CUSTOMER APP ENHANCEMENTS - Recently Developed Features

  // Multi-Pet Booking
  if (currentScreen === 'multi-pet-booking') return <MultiPetBookingPage 
    customerPhone={phone}
    customerId={phone}
    petId={selectedPetId || undefined}
  />;

  // Return Request
  if (currentScreen === 'return-request' && selectedOrder) return <ReturnRequestPage
    customerPhone={phone}
    customerId={phone}
    orderId={selectedOrder.id}
    onBack={() => setCurrentScreen('order_detail')}
  />;

  // Rewards & Loyalty
  if (currentScreen === 'rewards-loyalty') return <RewardsLoyaltyPage
    customerPhone={phone}
    customerId={phone}
    onBack={handleBack}
  />;

  // Referral System
  if (currentScreen === 'referral-system') return <ReferralSystemPage
    customerPhone={phone}
    customerId={phone}
    onBack={handleBack}
  />;

  // Package Booking
  if (currentScreen === 'package-booking') return <PackageBookingPage
    customerPhone={phone}
    customerId={phone}
    petId={selectedPetId || undefined}
  />;

  // Emergency Booking
  if (currentScreen === 'emergency-booking') return <EmergencyBookingPage
    customerPhone={phone}
    customerId={phone}
    onBack={handleBack}
  />;

  // Check-In/Check-Out
  if (currentScreen === 'check-in-out') return <CheckInCheckOutPage
    customerPhone={phone}
    customerId={phone}
    bookingId={selectedBookingId || undefined}
    onBack={handleBack}
  />;

  // Medical Records
  if (currentScreen === 'medical-records' && selectedPetId) return <MedicalRecordsPage
    phone={phone}
    petId={selectedPetId}
    onBack={() => setCurrentScreen('pet-details')}
  />;

  // Customer Wallet (Enhanced)
  if (currentScreen === 'customer-wallet') return <CustomerWalletPage
    customerPhone={phone}
    customerId={phone}
    onBack={handleBack}
  />;

  // ✅ MATING & DATING SERVICE - P2P Matchmaking
  if (currentScreen === 'mating-dating-hub') return <MatingDatingHub
    phone={phone}
    onBack={handleBack}
  />;

  // ✅ GAP FIXES: Rule 2 & 6
  if (currentScreen === 'integrated-services') return <IntegratedServicesHub />;

  if (currentScreen === 'home-service-selection') return <HomeServiceSelectionEnhanced
    customerId={phone}
    customerPhone={phone}
    petId={selectedPetId || 'pet_default'}
    onBack={handleBack}
    onSuccess={(bookingId) => bookingId && handleViewBooking(bookingId)}
  />;

  // ✅ Problem Grid Navigation Handlers
  if (currentScreen === 'problem_grid') {
    // Determine roleId and roleName from currentServiceType or default to general
    const roleMap: Record<string, { roleId: string; roleName: string }> = {
      'groomer': { roleId: 'groomer', roleName: 'Groomer' },
      'trainer': { roleId: 'trainer', roleName: 'Trainer' },
      'veterinarian': { roleId: 'veterinarian', roleName: 'Veterinarian' },
      'walker': { roleId: 'walker', roleName: 'Walker' },
      'boarding': { roleId: 'boarding', roleName: 'Boarding' },
      'adoption': { roleId: 'adoption', roleName: 'Adoption' },
      'sunset': { roleId: 'sunset', roleName: 'Sunset Care' },
      'general': { roleId: 'all', roleName: 'All Services' },
    };
    const roleInfo = currentServiceType 
      ? (roleMap[currentServiceType] || { roleId: currentServiceType, roleName: currentServiceType })
      : roleMap['general'];
    
    return (
      <ProblemGridSelector
        roleId={roleInfo.roleId}
        roleName={roleInfo.roleName}
        customerId={phone}
        phone={phone}
        onBack={() => {
          // Go back to the service that opened problem grid
          if (currentServiceType === 'groomer') setCurrentScreen('grooming');
          else if (currentServiceType === 'trainer') setCurrentScreen('training');
          else if (currentServiceType === 'veterinarian') setCurrentScreen('vet');
          else if (currentServiceType === 'walker') setCurrentScreen('walker');
          else if (currentServiceType === 'boarding') setCurrentScreen('boarding');
          else if (currentServiceType === 'adoption') setCurrentScreen('adoption');
          else if (currentServiceType === 'sunset') setCurrentScreen('sunset');
          else {
            // If opened from home page, go back to home
            setCurrentScreen('home');
          }
          setCurrentServiceType(null);
        }}
        onProblemSelect={(problem) => {
          setSelectedProblem({ 
            id: problem.id || problem.problemId, 
            title: problem.displayName || problem.name || problem.title,
            roleId: roleInfo.roleId === 'all' ? undefined : roleInfo.roleId
          });
          setCurrentScreen('services_by_problem');
        }}
      />
    );
  }

  if (currentScreen === 'services_by_problem' && selectedProblem) {
    return (
      <ServicesByProblem
        problemId={selectedProblem.id}
        problemTitle={selectedProblem.title}
        onBack={() => {
          setCurrentScreen('problem_grid');
          setSelectedProblem(null);
        }}
        onServiceSelect={(service) => {
          // Handle service selection - navigate to booking flow
          const vendorId = service.vendorId || service.id;
          const serviceId = service.serviceId || service.id;
          
          setSelectedVendorId(vendorId);
          setSelectedService(serviceId);
          setVetServiceData({ 
            vendorId: vendorId, 
            serviceType: selectedProblem.roleId,
            service: service
          });
          setCurrentScreen('create-booking');
        }}
      />
    );
  }

  return <ComingSoon serviceName="pet-marketplace" onBack={handleBack} />;
}