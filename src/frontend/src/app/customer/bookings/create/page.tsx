'use client';

import { CustomerHomeWrapper } from '../../../../components/customer/CustomerHomeWrapper';

export default function CreateBookingPage() {
  const phone = "+919876543210";
  return (
    <CustomerHomeWrapper 
      phone={phone} 
      onNavigate={(screen) => console.log('Navigate to:', screen)} 
      initialScreen="create-booking" 
    />
  );
}
