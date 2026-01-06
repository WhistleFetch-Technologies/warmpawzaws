'use client';

import React from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '4rem', margin: '0 0 1rem', color: '#dc2626' }}>500</h1>
      <h2 style={{ fontSize: '1.5rem', margin: '0 0 1rem', color: '#666' }}>Something went wrong</h2>
      <p style={{ margin: '0 0 2rem', color: '#999' }}>
        {error?.message || 'An unexpected error occurred'}
      </p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={reset}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#f97316',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
        <Link href="/" style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#6b7280',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '0.5rem',
          fontWeight: '500'
        }}>
          Go Home
        </Link>
      </div>
    </div>
  );
}

