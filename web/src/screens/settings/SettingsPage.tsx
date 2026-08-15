import React from 'react';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { VStack } from '@astryxdesign/core/VStack';
import { Selector } from '@astryxdesign/core/Selector';
import { useSearchParams } from 'react-router';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as SettingsTab | null;
  const activeTab: SettingsTab = rawTab && TABS.some((t) => t.value === rawTab) ? rawTab : 'hosts';
  const isNarrow = useIsNarrow();

  const handleTabChange = (tab: SettingsTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'hosts') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      return next;
    }, { replace: true });
  };

  return (
    <VStack gap={5}>
      <PageHeader eyebrow="КЕРУВАННЯ" title="Налаштування">
        {isNarrow ? (
          <Selector
            value={activeTab}
            onChange={(v) => handleTabChange(v as SettingsTab)}
            options={TABS.map((t) => ({ value: t.value, label: t.label }))}
          />
        ) : (
          <TabList value={activeTab} onChange={(v) => handleTabChange(v as SettingsTab)}>
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
