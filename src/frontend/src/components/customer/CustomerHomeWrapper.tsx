import { useState } from 'react';
import { CustomerHome } from './CustomerHomeComplete';
import { UserAccountSidebar } from './UserAccountSidebar';
import { CustomerProfile } from './CustomerProfile';
import { ComingSoon } from './ComingSoon';
import { CustomerServicesPage } from './CustomerServicesPage';
import { CustomerBookingsPage } from './CustomerBookingsPage';
import { CreateBookingPage } from './CreateBookingPage';
import { CustomerPetsPage } from './CustomerPetsPage';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { useNotificationService } from './useNotificationService';
import { toast } from 'sonner@2.0.3';

// Mock Cart Context to avoid build errors
const useCart = () => ({
  addToCart: (item: any) => console.log('Added to cart:', item),
  cartItems: [],
  removeFromCart: () => {},
  clearCart: () => {},
  cartTotal: 0
});

type ScreenType = 
  | 'home' 
  | 'customer-profile'
  | 'services'
  | 'bookings'
  | 'create-booking'
  | 'pets'
  | 'pet-details'
  | 'booking-details'
  | 'my-bookings'
  | 'shop'
  | 'vet'
  | 'grooming'
  | 'training'
  | 'boarding'
  | 'walking'
  | 'adoption'
  | 'coming-soon';

export function CustomerHomeWrapper({ phone, onNavigate, initialScreen }: { phone: string; onNavigate: (screen: string) => void; initialScreen?: ScreenType }) {
  console.log('CustomerHomeWrapper: Rendering with phone:', phone);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(initialScreen || 'home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userSidebarOpen, setUserSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Selected State
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>(undefined);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const { addToCart } = useCart();

  useNotificationService({
    phone: phone,
    enabled: !!phone,
    onNewNotification: async (notification) => {
      console.log('📬 [CUSTOMER-HOME] Notification received:', notification);
      // Notification handling logic
    }
  });
  
  const handleProfileClick = () => setUserSidebarOpen(true);
  const handleViewCustomerProfile = () => { setUserSidebarOpen(false); setCurrentScreen('customer-profile'); };
  
  const handleNavigateToService = (service: string) => {
    if (service === 'services') setCurrentScreen('services');
    else if (service === 'bookings') setCurrentScreen('bookings');
    else if (service === 'pets') setCurrentScreen('pets');
    else if (service === 'vet') setCurrentScreen('coming-soon'); // Placeholder
    else if (service === 'grooming') setCurrentScreen('coming-soon'); // Placeholder
    else if (service === 'training') setCurrentScreen('coming-soon'); // Placeholder
    else if (service === 'boarding') setCurrentScreen('coming-soon'); // Placeholder
    else if (service === 'walking') setCurrentScreen('coming-soon'); // Placeholder
    else if (service === 'shop') setCurrentScreen('coming-soon'); // Placeholder
    else {
      setSelectedService(service);
      setCurrentScreen('coming-soon');
    }
  };
  
  const handleAccountNavigate = (path: string) => {
    if (path === 'account/orders') setCurrentScreen('coming-soon');
    else if (path === 'account/addresses') setCurrentScreen('coming-soon');
    else if (path === 'account/wallet') setCurrentScreen('coming-soon');
    else if (path === 'account/settings') toast.info('Settings coming soon');
  };

  const handleBack = () => {
    setCurrentScreen('home');
    setSelectedPetId(null);
    setSelectedBookingId(null);
    setSelectedVendorId(undefined);
  };

  // RENDER LOGIC

  if (currentScreen === 'home') {
    return (
      <>
        <CustomerHome 
          phone={phone}
          refreshKey={refreshKey}
          onNavigate={handleNavigateToService}
          onProfileClick={handleProfileClick}
          onSidebarOpen={() => setSidebarOpen(true)}
          onPetClick={(id) => { setSelectedPetId(id); setCurrentScreen('pets'); }}
          onAddPet={() => { setCurrentScreen('pets'); }}
          onViewBooking={(id) => { setSelectedBookingId(id); setCurrentScreen('bookings'); }}
        />
        {userSidebarOpen && (
          <UserAccountSidebar 
            phone={phone}
            onClose={() => setUserSidebarOpen(false)}
            onViewBooking={(id) => { setSelectedBookingId(id); setCurrentScreen('bookings'); }}
            onViewCustomerProfile={handleViewCustomerProfile}
            onNavigate={handleAccountNavigate}
          />
        )}
      </>
    );
  }

  if (currentScreen === 'customer-profile') {
    return <CustomerProfile phone={phone} onBack={handleBack} onNavigate={setCurrentScreen} />;
  }

  if (currentScreen === 'services') {
    return <CustomerServicesPage 
      onBack={handleBack} 
      onNavigate={(screen, data) => { 
        if (screen === 'create-booking') { 
          setSelectedService(data?.serviceId);
          setSelectedVendorId(data?.vendorId);
          setCurrentScreen('create-booking');
        } else {
          handleNavigateToService(screen);
        }
      }} 
    />;
  }

  if (currentScreen === 'bookings' || currentScreen === 'my-bookings') {
    return <CustomerBookingsPage 
      phone={phone} 
      onBack={handleBack} 
      onNavigate={(screen, data) => {
        if (screen === 'booking-details') {
           // Handle booking details
           setSelectedBookingId(data.bookingId);
           toast.info('Booking details view coming soon');
        }
        else if (screen === 'services') setCurrentScreen('services');
      }} 
    />;
  }

  if (currentScreen === 'create-booking') {
    return <CreateBookingPage 
      phone={phone} 
      serviceId={selectedService} 
      vendorId={selectedVendorId} 
      onBack={() => setCurrentScreen('services')} 
      onSuccess={(bookingId) => {
        setSelectedBookingId(bookingId);
        setCurrentScreen('bookings');
      }} 
    />;
  }

  if (currentScreen === 'pets') {
    return <CustomerPetsPage 
      phone={phone} 
      onBack={handleBack} 
      onNavigate={(screen, data) => {
        if (screen === 'pet-details') {
           setSelectedPetId(data?.petId);
           toast.info('Pet details view coming soon');
        }
      }} 
      onAddPet={() => toast.info('Add pet modal coming soon')} 
    />;
  }

  return <ComingSoon onBack={handleBack} />;
}
