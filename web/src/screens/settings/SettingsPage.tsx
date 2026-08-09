import React, { useState } from 'react';
import { TabList } from '@astryxdesign/core/TabList';
import { Tab } from '@astryxdesign/core/TabList';
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

        <TabList value={activeTab} onChange={(v) => setActiveTab(v as SettingsTab)}>
          <Tab value="hosts" label="Хости" />
          <Tab value="personas" label="Персони" />
          <Tab value="patterns" label="Патерни" />
          <Tab value="providers" label="Провайдери" />
        </TabList>
      </div>

      {/* Active Panel View */}
      {activeTab === 'hosts' && <HostsPanel />}
      {activeTab === 'personas' && <PersonasPanel />}
      {activeTab === 'patterns' && <PatternsPanel />}
      {activeTab === 'providers' && <ProvidersPanel />}
    </div>
  );
};
