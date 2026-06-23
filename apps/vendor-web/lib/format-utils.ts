/** Indian Rupee sign — use \\u20B9 so source files stay valid under any editor encoding. */
const INR = '\u20B9';

/** Safely format a numeric price for display (never returns NaN). */
export function formatPrice(price: number | string | null | undefined): string {
  const n = typeof price === 'number' ? price : parseFloat(String(price ?? 0));
  if (Number.isNaN(n) || n < 0) return '0';
  return n.toLocaleString('en-IN');
}

/** Price with INR prefix, safe against NaN and encoding mojibake. */
export function formatPriceWithSymbol(price: number | string | null | undefined): string {
  return `${INR}${formatPrice(price)}`;
}

/**
 * Format operating hours object into a readable string
 * Handles both string and object formats
 */
export function formatOperatingHours(operatingHours: any): string {
  if (!operatingHours) return '';
  
  // If it's already a string, return it
  if (typeof operatingHours === 'string') {
    return operatingHours;
  }
  
  // If it's an object with day keys, format it
  if (typeof operatingHours === 'object') {
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayAbbrev: Record<string, string> = {
      monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
      friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
    };
    
    const openDays: { day: string; hours: string }[] = [];
    
    for (const day of dayOrder) {
      const dayData = operatingHours[day];
      if (dayData && dayData.isOpen) {
        const open = dayData.open || '09:00';
        const close = dayData.close || '18:00';
        openDays.push({ day: dayAbbrev[day], hours: `${open}-${close}` });
      }
    }
    
    if (openDays.length === 0) return 'Closed';
    
    // Group consecutive days with same hours
    const groups: { days: string[]; hours: string }[] = [];
    for (const od of openDays) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.hours === od.hours) {
        lastGroup.days.push(od.day);
      } else {
        groups.push({ days: [od.day], hours: od.hours });
      }
    }
    
    return groups.map(g => {
      if (g.days.length === 1) {
        return `${g.days[0]}: ${g.hours}`;
      }
      return `${g.days[0]}-${g.days[g.days.length - 1]}: ${g.hours}`;
    }).join(', ');
  }
  
  return '';
}
