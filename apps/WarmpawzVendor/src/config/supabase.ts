/**
 * Supabase Configuration for Vendor App
 * Identical to web app configuration
 */

export const projectId = "vpvpbdwtyugbknrntkho";
export const publicAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM";

export const SUPABASE_URL = `https://${projectId}.supabase.co`;
export const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

// Create Supabase client
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createClient(SUPABASE_URL, publicAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

