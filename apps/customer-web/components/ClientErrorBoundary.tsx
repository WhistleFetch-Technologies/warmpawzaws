'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '@/lib/client-error-reporting';

type Props = { children: ReactNode };

type State = { hasError: boolean };

export class ClientErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientError({
      source: 'react_boundary',
      code: 'react_render',
      message: error.message || 'React error',
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-medium text-neutral-800">Something went wrong</p>
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
