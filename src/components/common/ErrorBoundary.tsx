import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { handleError } from '../../utils/errorHandler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean; // Show error details in development
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary Component
 * 
 * Catches React errors in component tree and displays a fallback UI.
 * Prevents the entire app from crashing when a component throws an error.
 * 
 * Features:
 * - Catches rendering errors, lifecycle errors, and errors in constructors
 * - User-friendly error UI with recovery options
 * - Error reporting integration
 * - Development mode shows error details
 * - Production mode shows user-friendly message
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('🚨 ErrorBoundary caught an error:', error, errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Report error using centralized error handler
    handleError(error, {
      action: 'Component rendering',
      technical: error.message,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // TODO: Integrate with error tracking service (Sentry, LogRocket, etc.)
    // Example:
    // if (typeof Sentry !== 'undefined') {
    //   Sentry.captureException(error, {
    //     contexts: {
    //       react: {
    //         componentStack: errorInfo.componentStack,
    //       },
    //     },
    //   });
    // }
  }

  handleReset = () => {
    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    // Reload the page
    window.location.reload();
  };

  handleGoHome = () => {
    // Navigate to home (if using router)
    // For now, just reload to home
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      const isDevelopment = process.env.NODE_ENV === 'development';
      const showDetails = this.props.showDetails ?? isDevelopment;

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <CardTitle className="text-2xl">Something went wrong</CardTitle>
              </div>
              <CardDescription>
                We're sorry, but something unexpected happened. Don't worry, your data is safe.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* User-friendly message */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">
                  An error occurred while rendering this component. This has been logged and our team will investigate.
                </p>
              </div>

              {/* Error details (development only) */}
              {showDetails && this.state.error && (
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Bug className="h-4 w-4" />
                    Error Details (Development Mode)
                  </div>
                  <div className="text-xs font-mono bg-white p-3 rounded border overflow-auto max-h-64">
                    <div className="text-red-600 font-semibold mb-2">
                      {this.state.error.name}: {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <pre className="text-gray-700 whitespace-pre-wrap text-xs">
                        {this.state.error.stack}
                      </pre>
                    )}
                    {this.state.errorInfo && (
                      <div className="mt-3 pt-3 border-t border-gray-300">
                        <div className="text-gray-600 font-semibold mb-1">Component Stack:</div>
                        <pre className="text-gray-700 whitespace-pre-wrap text-xs">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recovery suggestions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm font-medium mb-2">What you can do:</p>
                <ul className="text-blue-700 text-sm space-y-1 list-disc list-inside">
                  <li>Try refreshing the page</li>
                  <li>Go back to the home page</li>
                  <li>If the problem persists, contact support</li>
                </ul>
              </div>
            </CardContent>

            <CardFooter className="flex flex-wrap gap-2">
              <Button
                onClick={this.handleReset}
                variant="default"
                className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button
                onClick={this.handleReload}
                variant="outline"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload Page
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
              >
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with ErrorBoundary
 * 
 * Usage:
 * ```tsx
 * export default withErrorBoundary(MyComponent);
 * ```
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}

/**
 * Hook to manually trigger error boundary (for testing)
 * 
 * Usage:
 * ```tsx
 * const triggerError = useErrorTrigger();
 * 
 * // In event handler:
 * triggerError(new Error('Test error'));
 * ```
 */
export function useErrorTrigger() {
  return (error: Error) => {
    throw error;
  };
}

