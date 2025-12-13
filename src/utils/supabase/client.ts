import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

// Use a global singleton to prevent multiple instances across hot module reloads
declare global {
  var __supabaseClient: ReturnType<typeof createSupabaseClient> | undefined;
}

export function createClient() {
  // Check global first (survives hot module reloads)
  if (globalThis.__supabaseClient) {
    return globalThis.__supabaseClient;
  }

  // Create new instance with auth persistence configuration
  const client = createSupabaseClient(
    `https://${projectId}.supabase.co`,
    publicAnonKey,
    {
      auth: {
        // Use a unique storage key to avoid conflicts
        storageKey: 'warmpawz-auth-token',
        // Auto-refresh tokens
        autoRefreshToken: true,
        // Persist session in local storage
        persistSession: true,
        // Detect session from URL (for OAuth callbacks)
        detectSessionInUrl: true
      }
    }
  );

  // Store in global
  globalThis.__supabaseClient = client;
  
  return client;
}

// Export a singleton instance
export const supabase = createClient();
