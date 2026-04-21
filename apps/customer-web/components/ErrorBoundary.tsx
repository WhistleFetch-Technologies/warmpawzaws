'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary Component
 * ✅ FIX: Added to prevent app crashes (NUT-CUST-001, VET-CUST-001)
 * 
 * Catches React errors and displays a user-friendly error screen
 * instead of crashing the entire application.
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
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 [ErrorBoundary] Caught error:', error);
    console.error('🚨 [ErrorBoundary] Error info:', errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Log to error tracking service (if available)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  /** True if this is a chunk load failure (e.g. after deploy, old chunk URL 404s). */
  isChunkLoadError = (): boolean => {
    const e = this.state.error;
    if (!e) return false;
    const msg = (e.message || '').toLowerCase();
    const name = (e as any).name || '';
    return (
      name === 'ChunkLoadError' ||
      msg.includes('loading chunk') ||
      msg.includes('chunkloaderror') ||
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('importing a module script failed') ||
      msg.includes('error loading dynamically imported module') ||
      (msg.includes('failed to fetch') && msg.includes('chunk'))
    );
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /** Full page reload to fetch fresh HTML and JS chunks (fixes ChunkLoadError after deploy). */
  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    this.handleReset();
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isChunkError = this.isChunkLoadError();

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {isChunkError ? 'Update available' : 'Something went wrong'}
            </h1>

            <p className="text-gray-600 mb-6">
              {isChunkError
                ? 'The app was updated. Reload the page to get the latest version and continue.'
                : "We're sorry, but something unexpected happened. Please try again or go back to the home page."}
            </p>

            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-gray-500 cursor-pointer select-none">
                  Technical details (copy for support)
                </summary>
                <p className="mt-2 text-xs font-mono text-red-600 break-words">
                  {this.state.error.toString()}
                </p>
                {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                  <pre className="mt-2 text-xs text-gray-500 overflow-auto max-h-32">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}

            <div className="flex flex-col gap-3">
              {isChunkError && (
                <Button
                  onClick={this.handleReload}
                  className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload page
                </Button>
              )}
              <div className="flex gap-3">
                {!isChunkError && (
                  <Button
                    onClick={this.handleReset}
                    variant="outline"
                    className="flex-1"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                )}
                <Button
                  onClick={this.handleGoHome}
                  className={isChunkError ? 'flex-1' : 'flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]'}
                  variant={isChunkError ? 'outline' : undefined}
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
