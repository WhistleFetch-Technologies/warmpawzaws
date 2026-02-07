'use client';

import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@warmpawz/ui';

interface Props {
  children: ReactNode;
  section: string;
  fallback?: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Section-level Error Boundary
 * 
 * Catches errors in individual dashboard sections without crashing the entire app.
 * Provides a user-friendly error message with retry option.
 * 
 * Usage:
 *   <SectionErrorBoundary section="services">
 *     <VendorServiceManagement {...props} />
 *   </SectionErrorBoundary>
 */
export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[SectionErrorBoundary] Error in ${this.props.section}:`, error);
    console.error('[SectionErrorBoundary] Component stack:', errorInfo.componentStack);
    
    // You could send this to an error reporting service
    // reportError({ section: this.props.section, error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Unable to load {this.props.section}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Something went wrong while loading this section. 
                {this.state.error?.message && (
                  <span className="block mt-1 text-xs text-red-600 font-mono">
                    {this.state.error.message}
                  </span>
                )}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleRetry}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Functional wrapper for use with hooks
 */
export function withSectionErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  section: string
) {
  return function WithErrorBoundary(props: P) {
    return (
      <SectionErrorBoundary section={section}>
        <WrappedComponent {...props} />
      </SectionErrorBoundary>
    );
  };
}

/**
 * Hook to create error boundary wrapper
 */
export function useSectionWrapper(section: string) {
  return ({ children }: { children: ReactNode }) => (
    <SectionErrorBoundary section={section}>
      {children}
    </SectionErrorBoundary>
  );
}
