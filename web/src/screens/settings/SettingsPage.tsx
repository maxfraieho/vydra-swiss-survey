import React, { useState } from 'react';
import { HostsPanel } from './HostsPanel';
import { PersonasPanel } from './PersonasPanel';
import { PatternsPanel } from './PatternsPanel';
import { ProvidersPanel } from './ProvidersPanel';

type SettingsTab = 'hosts' | 'personas' | 'patterns' | 'providers';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('hosts');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Tab Bar */}
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            ⚙️ КЕРУВАННЯ
          </span>
          <h2 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
            Налаштування
          </h2>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('hosts')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'hosts' ? '1px solid #38bdf8' : '1px solid #1e293b',
              background: activeTab === 'hosts' ? '#1e293b' : '#020617',
              color: activeTab === 'hosts' ? '#f8fafc' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            Хости
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('personas')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'personas' ? '1px solid #38bdf8' : '1px solid #1e293b',
              background: activeTab === 'personas' ? '#1e293b' : '#020617',
              color: activeTab === 'personas' ? '#f8fafc' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            Персони
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('patterns')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'patterns' ? '1px solid #38bdf8' : '1px solid #1e293b',
              background: activeTab === 'patterns' ? '#1e293b' : '#020617',
              color: activeTab === 'patterns' ? '#f8fafc' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            Патерни
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('providers')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'providers' ? '1px solid #38bdf8' : '1px solid #1e293b',
              background: activeTab === 'providers' ? '#1e293b' : '#020617',
              color: activeTab === 'providers' ? '#f8fafc' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            Провайдери
          </button>
        </div>
      </div>

      {/* Active Panel View */}
      {activeTab === 'hosts' && <HostsPanel />}
      {activeTab === 'personas' && <PersonasPanel />}
      {activeTab === 'patterns' && <PatternsPanel />}
      {activeTab === 'providers' && <ProvidersPanel />}
    </div>
  );
};
