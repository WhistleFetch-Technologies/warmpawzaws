import { NotAvailablePage, notAvailablePresets } from '@/components/vendor/NotAvailablePage';

export default function EmergencyPage() {
  return <NotAvailablePage {...notAvailablePresets.emergency_protocols} />;
}
