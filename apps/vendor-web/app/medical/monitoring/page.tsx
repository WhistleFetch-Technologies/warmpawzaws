import { NotAvailablePage, notAvailablePresets } from '@/components/vendor/NotAvailablePage';

export default function PatientMonitoringPage() {
  return <NotAvailablePage {...notAvailablePresets.patient_monitoring} />;
}
