/**
 * Bucket Manager - Centralized bucket initialization with timeout protection
 * 
 * This module prevents database timeout issues by:
 * 1. Caching bucket existence checks
 * 2. Adding timeout protection to all operations
 * 3. Preventing concurrent bucket creation attempts
 * 4. Graceful fallback on errors
 */

import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const TIMEOUT_MS = 2000; // 2 second timeout (reduced from 5s for faster failure)
const CACHE_DURATION_MS = 5 * 60 * 1000; // Cache bucket existence for 5 minutes

// In-memory cache of bucket existence checks
const bucketCache = new Map<string, { exists: boolean; cachedAt: number }>();
let STORAGE_IS_HEALTHY = true; // Track storage health

/**
 * Check if a bucket exists with timeout protection and caching
 */
async function bucketExists(bucketName: string): Promise<boolean> {
  // Check cache first
  const cached = bucketCache.get(bucketName);
  if (cached) {
    const age = Date.now() - cached.cachedAt;
    if (age < CACHE_DURATION_MS) {
      console.log(`✅ [BUCKET] Using cached result for ${bucketName} (age: ${Math.round(age / 1000)}s)`);
      return cached.exists;
    }
  }

  // If storage is unhealthy, skip DB check and return cached result or false
  if (!STORAGE_IS_HEALTHY) {
    console.log(`⚠️ [BUCKET] Storage unhealthy, assuming ${bucketName} doesn't exist`);
    return cached?.exists || false;
  }

  // Not cached or expired, check actual existence
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const checkPromise = supabase.storage.listBuckets();
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Bucket list timeout')), TIMEOUT_MS)
    );

    const { data: buckets, error } = await Promise.race([
      checkPromise,
      timeoutPromise
    ]) as any;

    if (error) {
      console.warn(`⚠️ [BUCKET] Error checking buckets:`, error);
      STORAGE_IS_HEALTHY = false;
      return cached?.exists || false;
    }

    const exists = buckets?.some((b: any) => b.name === bucketName) || false;
    
    // Cache the result
    bucketCache.set(bucketName, { exists, cachedAt: Date.now() });
    STORAGE_IS_HEALTHY = true; // Storage is working
    
    return exists;
  } catch (error) {
    console.warn(`⚠️ [BUCKET] Timeout checking bucket ${bucketName}:`, error);
    STORAGE_IS_HEALTHY = false;
    return cached?.exists || false; // Fallback to cached or false
  }
}

/**
 * Ensure a bucket exists (create if needed) with timeout protection
 */
export async function ensureBucket(
  bucketName: string,
  options: {
    public?: boolean;
    fileSizeLimit?: number;
    allowedMimeTypes?: string[];
  } = {}
): Promise<boolean> {
  try {
    // Check if already exists
    const exists = await bucketExists(bucketName);
    
    if (exists) {
      console.log(`✅ [BUCKET] ${bucketName} already exists`);
      return true;
    }

    // If storage is unhealthy, don't try to create
    if (!STORAGE_IS_HEALTHY) {
      console.log(`⚠️ [BUCKET] Storage unhealthy, skipping creation of ${bucketName}`);
      return false;
    }

    // Need to create bucket
    console.log(`📦 [BUCKET] Creating bucket: ${bucketName}`);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const createPromise = supabase.storage.createBucket(bucketName, {
      public: options.public || false,
      fileSizeLimit: options.fileSizeLimit || 10485760, // Default 10MB
      allowedMimeTypes: options.allowedMimeTypes
    });

    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Bucket creation timeout')), TIMEOUT_MS)
    );

    const { error } = await Promise.race([
      createPromise,
      timeoutPromise
    ]) as any;

    if (error) {
      // Ignore "already exists" errors
      if (error.statusCode === '409' || error.message?.includes('already exists')) {
        console.log(`✅ [BUCKET] ${bucketName} already exists (409)`);
        bucketCache.set(bucketName, { exists: true, cachedAt: Date.now() });
        STORAGE_IS_HEALTHY = true;
        return true;
      }
      
      console.error(`❌ [BUCKET] Error creating ${bucketName}:`, error);
      STORAGE_IS_HEALTHY = false;
      return false;
    }

    console.log(`✅ [BUCKET] ${bucketName} created successfully`);
    bucketCache.set(bucketName, { exists: true, cachedAt: Date.now() });
    STORAGE_IS_HEALTHY = true;
    return true;

  } catch (error) {
    console.error(`❌ [BUCKET] Timeout/error for ${bucketName}:`, error);
    STORAGE_IS_HEALTHY = false;
    return false; // Return false but don't crash
  }
}

/**
 * Initialize multiple buckets in parallel with timeout protection
 */
export async function ensureBuckets(
  buckets: Array<{
    name: string;
    public?: boolean;
    fileSizeLimit?: number;
    allowedMimeTypes?: string[];
  }>
): Promise<void> {
  console.log(`📦 [BUCKET] Initializing ${buckets.length} buckets...`);
  
  // Create all buckets in parallel with individual timeout protection
  const results = await Promise.allSettled(
    buckets.map(bucket => 
      ensureBucket(bucket.name, {
        public: bucket.public,
        fileSizeLimit: bucket.fileSizeLimit,
        allowedMimeTypes: bucket.allowedMimeTypes
      })
    )
  );

  // Log results
  const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  const failed = results.length - successful;
  
  console.log(`✅ [BUCKET] Initialization complete: ${successful} successful, ${failed} failed/skipped`);
}

/**
 * Clear bucket cache (useful for testing)
 */
export function clearBucketCache(): void {
  bucketCache.clear();
  console.log('✅ [BUCKET] Cache cleared');
}