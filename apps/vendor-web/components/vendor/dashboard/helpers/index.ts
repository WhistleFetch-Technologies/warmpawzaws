// ✅ Helper to format booking time from "HH:MM:SS" to "HH:MM AM/PM"
export function formatBookingTime(time: string): string {
    if (!time) return 'N/A';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }
  