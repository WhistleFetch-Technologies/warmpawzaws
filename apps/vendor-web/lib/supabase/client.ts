/**
 * Supabase Client for Vendor Web
 * AWS Serverless compatible - placeholder for backward compatibility
 * 
 * ⚠️ DEPRECATED: Use apiClient from '@/lib/api-client' instead
 */

// Placeholder for backward compatibility - use apiClient instead
export const supabase = {
  auth: {
    signInWithPassword: async () => {
      console.warn('⚠️ supabase.auth.signInWithPassword is deprecated. Use apiClient with Cognito authentication instead.');
      throw new Error('Supabase auth is deprecated. Use apiClient with Cognito authentication.');
    },
    signOut: async () => {
      console.warn('⚠️ supabase.auth.signOut is deprecated. Use apiClient with Cognito authentication instead.');
      return { error: null };
    },
    getUser: async () => {
      console.warn('⚠️ supabase.auth.getUser is deprecated. Use apiClient with Cognito authentication instead.');
      return { data: { user: null }, error: null };
    },
    onAuthStateChange: () => {
      console.warn('⚠️ supabase.auth.onAuthStateChange is deprecated. Use Cognito auth hooks instead.');
      return { data: { subscription: null }, error: null };
    }
  },
  from: () => {
    console.warn('⚠️ supabase.from is deprecated. Use apiClient for API calls instead.');
    return {
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null })
    };
  }
} as any;

