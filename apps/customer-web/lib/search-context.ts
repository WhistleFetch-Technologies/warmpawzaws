/**
 * ============================================================================
 * SEARCH CONTEXT MANAGEMENT
 * ============================================================================
 * 
 * Manages search state to enforce search-first flow
 * Stores search query and results in localStorage for navigation
 * 
 * Date: 2026-01-28
 * Phase: 4 - Task 3
 * ============================================================================
 */

export interface SearchContext {
  query: string;
  category?: string;
  timestamp: number;
  results?: any[];
  selectedVendorId?: string;
  selectedServiceId?: string;
}

const SEARCH_CONTEXT_KEY = 'warmpawz_search_context';
const CONTEXT_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Save search context to localStorage
 */
export function saveSearchContext(context: SearchContext): void {
  try {
    const data = {
      ...context,
      timestamp: Date.now(),
    };
    localStorage.setItem(SEARCH_CONTEXT_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save search context:', error);
  }
}

/**
 * Get search context from localStorage
 */
export function getSearchContext(): SearchContext | null {
  try {
    const stored = localStorage.getItem(SEARCH_CONTEXT_KEY);
    if (!stored) return null;

    const context = JSON.parse(stored) as SearchContext;
    
    // Check if context has expired
    const age = Date.now() - context.timestamp;
    if (age > CONTEXT_EXPIRY_MS) {
      clearSearchContext();
      return null;
    }

    return context;
  } catch (error) {
    console.error('Failed to get search context:', error);
    return null;
  }
}

/**
 * Clear search context
 */
export function clearSearchContext(): void {
  try {
    localStorage.removeItem(SEARCH_CONTEXT_KEY);
  } catch (error) {
    console.error('Failed to clear search context:', error);
  }
}

/**
 * Check if search context exists and is valid
 */
export function hasValidSearchContext(): boolean {
  return getSearchContext() !== null;
}

/**
 * Update search context with selected vendor/service
 */
export function updateSearchContextSelection(
  vendorId?: string,
  serviceId?: string
): void {
  const context = getSearchContext();
  if (context) {
    saveSearchContext({
      ...context,
      selectedVendorId: vendorId,
      selectedServiceId: serviceId,
    });
  }
}

/**
 * Check if booking is allowed (has search context)
 */
export function isBookingAllowed(): boolean {
  return hasValidSearchContext();
}

