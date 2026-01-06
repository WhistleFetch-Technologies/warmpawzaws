'use client';

import React from 'react';
import Link from 'next/link';

export default function NotFound() {
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
      <h1 style={{ fontSize: '4rem', margin: '0 0 1rem', color: '#333' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', margin: '0 0 1rem', color: '#666' }}>Page Not Found</h2>
      <p style={{ margin: '0 0 2rem', color: '#999' }}>
        The page you are looking for does not exist.
      </p>
      <Link href="/" style={{
        padding: '0.75rem 1.5rem',
        backgroundColor: '#f97316',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '0.5rem',
        fontWeight: '500'
      }}>
        Go Home
      </Link>
    </div>
  );
}

