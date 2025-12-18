/**
 * Auth Service for Vendor Mobile App
 * Handles OTP generation and verification
 */

import { projectId, publicAnonKey } from '../config/api';

export interface OTPResponse {
  success: boolean;
  uatMode?: boolean;
  message?: string;
}

export interface LoginResponse {
  success: boolean;
  session?: any;
  vendor?: any;
  profile?: any;
  state?: string;
  error?: string;
}

export const authService = {
  /**
   * Send OTP to phone number
   */
  sendOTP: async (phone: string): Promise<OTPResponse> => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/otp/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ phone: cleanPhone }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send OTP');
    }

    return response.json();
  },

  /**
   * Verify OTP and login
   */
  verifyOTP: async (phone: string, otp: string): Promise<LoginResponse> => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    
    // First check if staff member
    try {
      const staffCheckResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/auth/check-phone`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ phone: cleanPhone }),
        }
      );

      if (staffCheckResponse.ok) {
        const staffData = await staffCheckResponse.json();
        if (staffData.exists && staffData.staff) {
          // Staff login
          const staffLoginResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/auth/login`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${publicAnonKey}`,
              },
              body: JSON.stringify({ phone: cleanPhone }),
            }
          );

          if (staffLoginResponse.ok) {
            const staffLoginData = await staffLoginResponse.json();
            return {
              success: true,
              session: {
                phone: cleanPhone,
                isStaff: true,
                staff: staffLoginData.staff,
              },
            };
          }
        }
      }
    } catch (error) {
      // Continue with vendor login if staff check fails
      console.log('Not a staff member, proceeding with vendor login');
    }

    // Vendor login
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/auth/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          phone: cleanPhone,
          otp: otp,
          portal: 'vendor',
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to verify OTP');
    }

    return response.json();
  },
};

