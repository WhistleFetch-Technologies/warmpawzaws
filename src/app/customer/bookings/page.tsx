'use client';

import { CustomerHomeWrapper } from '../../../components/customer/CustomerHomeWrapper';

export default function BookingsPage() {
  const phone = "9611377119";
  return (
    <CustomerHomeWrapper 
      phone={phone} 
      onNavigate={(screen) => console.log('Navigate to:', screen)} 
      initialScreen="bookings" 
    />
  );
}
