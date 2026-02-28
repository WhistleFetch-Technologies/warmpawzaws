/**
 * ============================================================================
 * ERROR TRACKING UTILITY
 * ============================================================================
 * 
 * Centralized error tracking with CloudWatch (primary) and Sentry (optional)
 * CloudWatch is the primary solution for India data residency compliance
 * 
 * Features:
 * - CloudWatch Logs with structured JSON logging
 * - CloudWatch Metrics for error rates
 * - CloudWatch Logs Insights queries support
 * - Optional Sentry integration (if DSN provided)
 * 
 * Date: 2026-01-02
 * Updated: 2026-01-02 - Enhanced CloudWatch support for India data residency
 * ============================================================================
 */

import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

/**
 * Error tracking configuration
 */
interface ErrorTrackingConfig {
  dsn?: string;
  environment: string;
  enabled: boolean;
  useCloudWatchMetrics?: boolean;
  cloudWatchNamespace?: string;
}

// Sentry SDK - conditionally imported to avoid errors if not installed
let Sentry: any = null;
try {
  // Dynamic import to avoid build errors if Sentry is not installed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Sentry = require('@sentry/serverless');
} catch (e) {
  // Sentry not installed - will use CloudWatch logging only
  // This is expected for India data residency compliance
}

// CloudWatch client for metrics
let cloudWatchClient: CloudWatchClient | null = null;

let errorTrackingInitialized = false;
let errorCount = 0;
let warningCount = 0;
let infoCount = 0;

/**
 * Initialize error tracking
 * Should be called once at Lambda initialization
 */
export function initializeErrorTracking(config: ErrorTrackingConfig): void {
  if (errorTrackingInitialized) {
    return; // Already initialized
  }

  // Always initialize CloudWatch (primary solution)
  if (config.useCloudWatchMetrics !== false) {
    try {
      cloudWatchClient = new CloudWatchClient({
        region: process.env.AWS_REGION || 'ap-south-1',
      });
      console.log('[Error Tracking] CloudWatch metrics client initialized');
    } catch (error) {
      console.error('[Error Tracking] Failed to initialize CloudWatch client:', error);
    }
  }

  // Initialize Sentry only if DSN is provided (optional)
  if (config.enabled && config.dsn && Sentry) {
    try {
      Sentry.AWSLambda.init({
        dsn: config.dsn,
        environment: config.environment,
        tracesSampleRate: config.environment === 'prod' ? 0.1 : 1.0,
        beforeSend(event: any) {
          // Filter sensitive data
          if (event.request?.cookies) {
            delete event.request.cookies;
          }
          if (event.request?.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['Authorization'];
            delete event.request.headers['x-uat-token'];
            delete event.request.headers['X-UAT-Token'];
          }
          return event;
        },
      });
      console.log(`[Error Tracking] Sentry initialized (optional) for environment: ${config.environment}`);
    } catch (error) {
      console.error('[Error Tracking] Failed to initialize Sentry:', error);
    }
  } else {
    if (!config.dsn) {
      console.log(`[Error Tracking] CloudWatch-only mode (India data residency compliant) for environment: ${config.environment}`);
    } else {
      console.log(`[Error Tracking] CloudWatch logging active for environment: ${config.environment}`);
    }
  }

  errorTrackingInitialized = true;
}

/**
 * Publish error metric to CloudWatch
 */
async function publishErrorMetric(errorType: string, severity: 'error' | 'warning' | 'info' = 'error'): Promise<void> {
  if (!cloudWatchClient) {
    return;
  }

  try {
    const namespace = process.env.CLOUDWATCH_METRICS_NAMESPACE || 'Warmpawz/Errors';
    const environment = process.env.ENVIRONMENT || 'development';

    await cloudWatchClient.send(
      new PutMetricDataCommand({
        Namespace: namespace,
        MetricData: [
          {
            MetricName: 'ErrorCount',
            Value: 1,
            Unit: 'Count',
            Timestamp: new Date(),
            Dimensions: [
              { Name: 'Environment', Value: environment },
              { Name: 'ErrorType', Value: errorType },
              { Name: 'Severity', Value: severity },
            ],
          },
        ],
      })
    );
  } catch (error) {
    // Don't throw - metrics are non-critical
    console.error('[Error Tracking] Failed to publish CloudWatch metric:', error);
  }
}

/**
 * Capture exception with enhanced CloudWatch logging
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  errorCount++;
  const errorType = error.name || 'Error';
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Enhanced CloudWatch structured logging
  const logData = {
    level: 'ERROR',
    errorId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      type: errorType,
    },
    context: {
      ...context,
      requestId: context?.requestId || 'unknown',
      path: context?.path,
      method: context?.method,
      userId: context?.userId,
    },
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT || 'development',
    // Structured for CloudWatch Logs Insights queries
    _metadata: {
      errorType,
      severity: 'error',
      hasStack: !!error.stack,
      contextKeys: context ? Object.keys(context).join(',') : '',
    },
  };

  // Log to CloudWatch with structured JSON
  console.error(JSON.stringify(logData));

  // Publish CloudWatch metric
  publishErrorMetric(errorType, 'error').catch(() => {
    // Ignore metric errors
  });

  // Send to Sentry if available (optional)
  if (Sentry) {
    try {
      Sentry.captureException(error, {
        contexts: {
          custom: context || {},
        },
        tags: {
          environment: process.env.ENVIRONMENT || 'development',
          errorType,
          errorId,
        },
      });
    } catch (e) {
      console.error('[Error Tracking] Failed to send exception to Sentry:', e);
    }
  }
}

/**
 * Capture message with enhanced CloudWatch logging
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
): void {
  if (level === 'error') {
    errorCount++;
  } else if (level === 'warning') {
    warningCount++;
  } else {
    infoCount++;
  }

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Enhanced CloudWatch structured logging
  const logData = {
    level: level.toUpperCase(),
    messageId,
    message,
    context: context || {},
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT || 'development',
    _metadata: {
      severity: level,
      contextKeys: context ? Object.keys(context).join(',') : '',
    },
  };

  // Log to CloudWatch with structured JSON
  const logMethod = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
  logMethod(JSON.stringify(logData));

  // Publish CloudWatch metric
  if (level === 'error' || level === 'warning') {
    publishErrorMetric('Message', level).catch(() => {
      // Ignore metric errors
    });
  }

  // Send to Sentry if available (optional)
  if (Sentry) {
    try {
      Sentry.captureMessage(message, {
        level: level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info',
        contexts: {
          custom: context || {},
        },
        tags: {
          environment: process.env.ENVIRONMENT || 'development',
          messageId,
        },
      });
    } catch (e) {
      console.error('[Error Tracking] Failed to send message to Sentry:', e);
    }
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId?: string, userRole?: string, additionalContext?: Record<string, any>): void {
  // Log to CloudWatch
  console.log(JSON.stringify({
    level: 'INFO',
    type: 'user_context',
    userId,
    userRole,
    additionalContext,
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT || 'development',
  }));

  // Set Sentry user context if available (optional)
  if (Sentry) {
    try {
      Sentry.setUser({
        id: userId,
        role: userRole,
        ...additionalContext,
      });
    } catch (e) {
      console.error('[Error Tracking] Failed to set Sentry user context:', e);
    }
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
): void {
  // Log to CloudWatch
  console.log(JSON.stringify({
    level: level.toUpperCase() as 'INFO' | 'WARNING' | 'ERROR',
    type: 'breadcrumb',
    message,
    category,
    data,
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT || 'development',
  }));

  // Add Sentry breadcrumb if available (optional)
  if (Sentry) {
    try {
      Sentry.addBreadcrumb({
        message,
        category,
        level: level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info',
        data,
      });
    } catch (e) {
      console.error('[Error Tracking] Failed to add Sentry breadcrumb:', e);
    }
  }
}

/**
 * Get error tracking configuration from environment
 */
export function getErrorTrackingConfig(): ErrorTrackingConfig {
  return {
    dsn: process.env.SENTRY_DSN, // Optional - only if Sentry is needed
    environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',
    enabled: process.env.ENABLE_ERROR_TRACKING === 'true' || process.env.ENVIRONMENT === 'prod',
    useCloudWatchMetrics: process.env.USE_CLOUDWATCH_METRICS !== 'false', // Default: true
    cloudWatchNamespace: process.env.CLOUDWATCH_METRICS_NAMESPACE || 'Warmpawz/Errors',
  };
}

/**
 * Get error statistics (for monitoring)
 */
export function getErrorStats(): {
  errorCount: number;
  warningCount: number;
  infoCount: number;
} {
  return {
    errorCount,
    warningCount,
    infoCount,
  };
}
