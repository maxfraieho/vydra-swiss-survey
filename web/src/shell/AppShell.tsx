import React from 'react';
import { Outlet } from 'react-router';
import { StatusBar } from './StatusBar';
import { Nav } from './Nav';

export const AppShell: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <StatusBar />
      <Nav />
      <main style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
};
