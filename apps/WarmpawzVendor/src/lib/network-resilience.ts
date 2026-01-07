/**
 * ============================================================================
 * NETWORK RESILIENCE MODULE FOR VENDOR MOBILE APP
 * ============================================================================
 * 
 * Provides robust network handling with:
 * - Automatic retry with exponential backoff
 * - Offline detection and queue management
 * - Request deduplication
 * - Timeout handling
 * - Error classification
 * 
 * Date: 2026-01-02
 * ============================================================================
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
  retryableErrors: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'Network request failed'],
};

const REQUEST_TIMEOUT_MS = 30000;
const OFFLINE_QUEUE_KEY = '@warmpawz_vendor_offline_queue';
const MAX_QUEUE_SIZE = 100;

// ============================================================================
// TYPES
// ============================================================================

export type NetworkStatus = 'online' | 'offline' | 'unknown';

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  retryCount: number;
  priority: 'high' | 'normal' | 'low';
}

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
}

export type NetworkErrorType = 
  | 'network_error'
  | 'timeout'
  | 'server_error'
  | 'client_error'
  | 'offline'
  | 'unknown';

export class NetworkError extends Error {
  type: NetworkErrorType;
  statusCode?: number;
  isRetryable: boolean;
  originalError?: Error;

  constructor(
    message: string,
    type: NetworkErrorType,
    statusCode?: number,
    isRetryable = false,
    originalError?: Error
  ) {
    super(message);
    this.name = 'NetworkError';
    this.type = type;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
    this.originalError = originalError;
  }
}

// ============================================================================
// NETWORK MONITOR
// ============================================================================

class NetworkMonitor {
  private static instance: NetworkMonitor;
  private isConnected: boolean = true;
  private listeners: Set<(state: NetworkState) => void> = new Set();
  private unsubscribe: (() => void) | null = null;

  private constructor() {
    this.initialize();
  }

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  private initialize() {
    this.unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected ?? false;
      
      const networkState: NetworkState = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      };

      // Notify listeners
      this.listeners.forEach(listener => listener(networkState));

      // Process queue if we came back online
      if (!wasConnected && this.isConnected) {
        console.log('[NetworkMonitor] Network restored, processing offline queue');
        OfflineQueue.getInstance().processQueue();
      }
    });
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  async checkConnection(): Promise<NetworkState> {
    const state = await NetInfo.fetch();
    this.isConnected = state.isConnected ?? false;
    return {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
    };
  }

  addListener(listener: (state: NetworkState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.listeners.clear();
  }
}

// ============================================================================
// OFFLINE QUEUE
// ============================================================================

class OfflineQueue {
  private static instance: OfflineQueue;
  private queue: QueuedRequest[] = [];
  private isProcessing: boolean = false;
  private onRequestComplete?: (request: QueuedRequest, success: boolean) => void;

  private constructor() {
    this.loadQueue();
  }

  static getInstance(): OfflineQueue {
    if (!OfflineQueue.instance) {
      OfflineQueue.instance = new OfflineQueue();
    }
    return OfflineQueue.instance;
  }

  private async loadQueue() {
    try {
      const stored = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        // Clean up old requests (older than 24 hours)
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        this.queue = this.queue.filter(req => req.timestamp > cutoff);
        await this.saveQueue();
      }
    } catch (error) {
      console.error('[OfflineQueue] Error loading queue:', error);
    }
  }

  private async saveQueue() {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[OfflineQueue] Error saving queue:', error);
    }
  }

  setOnRequestComplete(callback: (request: QueuedRequest, success: boolean) => void) {
    this.onRequestComplete = callback;
  }

  async enqueue(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedRequest: QueuedRequest = {
      ...request,
      id,
      timestamp: Date.now(),
      retryCount: 0,
    };

    // Check for duplicate requests (same URL and body within last 5 seconds)
    const isDuplicate = this.queue.some(
      req => 
        req.url === request.url && 
        req.body === request.body && 
        Date.now() - req.timestamp < 5000
    );

    if (isDuplicate) {
      console.log('[OfflineQueue] Duplicate request ignored:', request.url);
      return id;
    }

    // Enforce max queue size (remove oldest low-priority items)
    while (this.queue.length >= MAX_QUEUE_SIZE) {
      const lowPriorityIdx = this.queue.findIndex(r => r.priority === 'low');
      if (lowPriorityIdx !== -1) {
        this.queue.splice(lowPriorityIdx, 1);
      } else {
        const normalPriorityIdx = this.queue.findIndex(r => r.priority === 'normal');
        if (normalPriorityIdx !== -1) {
          this.queue.splice(normalPriorityIdx, 1);
        } else {
          break; // All high priority, don't remove
        }
      }
    }

    this.queue.push(queuedRequest);
    
    // Sort by priority
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    await this.saveQueue();
    return id;
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    const networkMonitor = NetworkMonitor.getInstance();
    if (!networkMonitor.getIsConnected()) {
      console.log('[OfflineQueue] Still offline, skipping queue processing');
      return;
    }

    this.isProcessing = true;
    console.log(`[OfflineQueue] Processing ${this.queue.length} queued requests`);

    const processedIds: string[] = [];

    for (const request of [...this.queue]) {
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });

        if (response.ok) {
          processedIds.push(request.id);
          this.onRequestComplete?.(request, true);
        } else if (request.retryCount < 3) {
          request.retryCount++;
        } else {
          processedIds.push(request.id);
          this.onRequestComplete?.(request, false);
        }
      } catch (error) {
        if (request.retryCount < 3) {
          request.retryCount++;
        } else {
          processedIds.push(request.id);
          this.onRequestComplete?.(request, false);
        }
      }
    }

    this.queue = this.queue.filter(req => !processedIds.includes(req.id));
    await this.saveQueue();
    this.isProcessing = false;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  async clearQueue() {
    this.queue = [];
    await this.saveQueue();
  }
}

// ============================================================================
// RESILIENT FETCH
// ============================================================================

export async function resilientFetch(
  url: string,
  options: RequestInit = {},
  config: Partial<RetryConfig> = {}
): Promise<Response> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const networkMonitor = NetworkMonitor.getInstance();

  // Check network connectivity first
  if (!networkMonitor.getIsConnected()) {
    throw new NetworkError(
      'No network connection',
      'offline',
      undefined,
      true
    );
  }

  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt <= retryConfig.maxRetries) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Success
      if (response.ok) {
        return response;
      }

      // Check if error is retryable
      if (retryConfig.retryableStatusCodes.includes(response.status)) {
        lastError = new NetworkError(
          `HTTP ${response.status}`,
          response.status >= 500 ? 'server_error' : 'client_error',
          response.status,
          true
        );
      } else {
        // Non-retryable error
        throw new NetworkError(
          `HTTP ${response.status}`,
          response.status >= 500 ? 'server_error' : 'client_error',
          response.status,
          false
        );
      }
    } catch (error: any) {
      // Handle abort (timeout)
      if (error.name === 'AbortError') {
        lastError = new NetworkError(
          'Request timeout',
          'timeout',
          undefined,
          true
        );
      }
      // Handle network errors
      else if (
        error.message?.includes('Network request failed') ||
        error.message?.includes('Failed to fetch') ||
        retryConfig.retryableErrors.some(e => error.message?.includes(e))
      ) {
        lastError = new NetworkError(
          error.message || 'Network error',
          'network_error',
          undefined,
          true,
          error
        );
      }
      // Non-retryable error
      else if (error instanceof NetworkError && !error.isRetryable) {
        throw error;
      }
      // Unknown error
      else {
        lastError = error;
      }
    }

    // Check if we should retry
    if (attempt < retryConfig.maxRetries) {
      const delay = Math.min(
        retryConfig.baseDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt),
        retryConfig.maxDelayMs
      );
      
      // Add jitter (±25%)
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      const totalDelay = delay + jitter;

      console.log(`[resilientFetch] Retry ${attempt + 1}/${retryConfig.maxRetries} in ${Math.round(totalDelay)}ms`);
      await sleep(totalDelay);
    }

    attempt++;
  }

  // All retries exhausted
  throw lastError || new NetworkError('Unknown error', 'unknown');
}

// ============================================================================
// UTILITIES
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function classifyError(error: any): NetworkErrorType {
  if (error instanceof NetworkError) {
    return error.type;
  }
  
  if (error?.message?.includes('Network request failed')) {
    return 'network_error';
  }
  
  if (error?.message?.includes('timeout') || error?.name === 'AbortError') {
    return 'timeout';
  }
  
  return 'unknown';
}

export function isRetryableError(error: any): boolean {
  if (error instanceof NetworkError) {
    return error.isRetryable;
  }
  
  const retryableMessages = [
    'Network request failed',
    'Failed to fetch',
    'timeout',
    'ECONNRESET',
    'ETIMEDOUT',
  ];
  
  return retryableMessages.some(msg => 
    error?.message?.toLowerCase().includes(msg.toLowerCase())
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export const networkMonitor = NetworkMonitor.getInstance();
export const offlineQueue = OfflineQueue.getInstance();

export {
  NetworkMonitor,
  OfflineQueue,
  DEFAULT_RETRY_CONFIG,
};

