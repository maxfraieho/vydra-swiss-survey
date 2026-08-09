import React, { useState } from 'react';
import { TabList } from '@astryxdesign/core/TabList';
import { Tab } from '@astryxdesign/core/TabList';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { HostsPanel } from './HostsPanel';
import { PersonasPanel } from './PersonasPanel';
import { PatternsPanel } from './PatternsPanel';
import { ProvidersPanel } from './ProvidersPanel';
import { AISourcePanel } from './AISourcePanel';

type SettingsTab = 'hosts' | 'personas' | 'patterns' | 'providers' | 'ai-source';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('hosts');

  return (
    <VStack gap={5}>
      {/* Header & Tab Bar */}
      <Card
        padding={4}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div>
          <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            ⚙️ КЕРУВАННЯ
          </span>
          <Heading level={2} style={{ marginTop: '4px', fontSize: '18px' }}>
            Налаштування
          </Heading>
        </div>

        <TabList value={activeTab} onChange={(v) => setActiveTab(v as SettingsTab)}>
          <Tab value="hosts" label="Хости" />
          <Tab value="personas" label="Персони" />
          <Tab value="patterns" label="Патерни" />
          <Tab value="providers" label="Провайдери" />
          <Tab value="ai-source" label="Модель ШІ" />
        </TabList>
      </Card>

      {/* Active Panel View */}
      {activeTab === 'hosts' && <HostsPanel />}
      {activeTab === 'personas' && <PersonasPanel />}
      {activeTab === 'patterns' && <PatternsPanel />}
      {activeTab === 'providers' && <ProvidersPanel />}
      {activeTab === 'ai-source' && <AISourcePanel />}
    </VStack>
  );
};

