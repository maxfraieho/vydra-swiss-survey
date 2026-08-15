import React, { useState } from 'react';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { VStack } from '@astryxdesign/core/VStack';
import { Selector } from '@astryxdesign/core/Selector';
import { PageHeader } from '../../ui/primitives';
import { useIsNarrow } from '../../shell/useIsNarrow';
import { HostsPanel } from './HostsPanel';
import { PersonasPanel } from './PersonasPanel';
import { PatternsPanel } from './PatternsPanel';
import { ProvidersPanel } from './ProvidersPanel';
import { AISourcePanel } from './AISourcePanel';
import { BrowserSourcesPanel } from './BrowserSourcesPanel';
import { TelegramSettingsPanel } from './TelegramSettingsPanel';
import { HostGate } from '../gate/HostGate';

type SettingsTab =
  | 'hosts'
  | 'gate'
  | 'personas'
  | 'patterns'
  | 'providers'
  | 'ai-source'
  | 'browser'
  | 'telegram';

const TABS: { value: SettingsTab; label: string }[] = [
  { value: 'hosts', label: 'Хости' },
  { value: 'gate', label: 'Доступи (Gate)' },
  { value: 'personas', label: 'Персони' },
  { value: 'patterns', label: 'Патерни' },
  { value: 'providers', label: 'Провайдери' },
  { value: 'ai-source', label: 'Модель ШІ' },
  { value: 'browser', label: 'Браузер' },
  { value: 'telegram', label: 'Telegram' },
];

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('hosts');
  const isNarrow = useIsNarrow();

  return (
    <VStack gap={5}>
      <PageHeader eyebrow="КЕРУВАННЯ" title="Налаштування">
        {isNarrow ? (
          <Selector
            value={activeTab}
            onChange={(v) => setActiveTab(v as SettingsTab)}
            options={TABS.map((t) => ({ value: t.value, label: t.label }))}
          />
        ) : (
          <TabList value={activeTab} onChange={(v) => setActiveTab(v as SettingsTab)}>
            {TABS.map((t) => (
              <Tab key={t.value} value={t.value} label={t.label} />
            ))}
          </TabList>
        )}
      </PageHeader>

      {activeTab === 'hosts' && <HostsPanel />}
      {activeTab === 'gate' && <HostGate />}
      {activeTab === 'personas' && <PersonasPanel />}
      {activeTab === 'patterns' && <PatternsPanel />}
      {activeTab === 'providers' && <ProvidersPanel />}
      {activeTab === 'ai-source' && <AISourcePanel />}
      {activeTab === 'browser' && <BrowserSourcesPanel />}
      {activeTab === 'telegram' && <TelegramSettingsPanel />}
    </VStack>
  );
};
