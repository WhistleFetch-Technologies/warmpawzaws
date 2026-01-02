/**
 * Permission Utilities
 * Check user permissions and roles
 */

export function isStaffUser(session: any): boolean {
  return !!(session?.isStaffLogin || session?.user?.isStaff || session?.staff);
}

export function isVendorUser(session: any): boolean {
  return !!(session?.profile || session?.vendorId) && !isStaffUser(session);
}

export function getStaffId(session: any): string | null {
  if (isStaffUser(session)) {
    return session?.staff?.id || session?.staffId || null;
  }
  return null;
}

export function getVendorId(session: any): string | null {
  if (isVendorUser(session)) {
    return session?.profile?.id || session?.vendorId || session?.profile?.vendorId || null;
  }
  return null;
}

export function canViewAllBookings(session: any): boolean {
  return isVendorUser(session);
}

export function canAcceptRejectBookings(session: any): boolean {
  return isVendorUser(session);
}

export function canAssignStaff(session: any): boolean {
  return isVendorUser(session);
}

export function canManageServices(session: any): boolean {
  return isVendorUser(session);
}

export function canViewEarnings(session: any): boolean {
  // Both vendors and staff can view earnings, but different screens
  return true;
}

export function canManageStaff(session: any): boolean {
  return isVendorUser(session);
}

