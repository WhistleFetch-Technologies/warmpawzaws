'use client';

import { useEffect, useState } from 'react';
import { InsuranceServicesLanding } from '@/components/customer/InsuranceServicesLanding';

export default function InsurancePage() {
  const [phone, setPhone] = useState('');
  useEffect(() => {
    setPhone((localStorage.getItem('customerPhone') || '').replace(/\D/g, ''));
  }, []);

  return (
    <InsuranceServicesLanding
      phone={phone}
      onBack={() => {
        window.location.href = '/';
      }}
      onNavigate={(screen, data) => {
        if (screen === 'insurance_plan') {
          window.location.href = `/?insurancePlan=${encodeURIComponent(String(data?.planId || 'consult'))}`;
          return;
        }
        if (screen === 'insurance_quote') {
          window.location.href = '/?resumeScreen=insurance_quote';
          return;
        }
        if (screen === 'my_insurance') {
          window.location.href = '/?resumeScreen=my_insurance';
          return;
        }
        window.location.href = '/';
      }}
    />
  );
}
