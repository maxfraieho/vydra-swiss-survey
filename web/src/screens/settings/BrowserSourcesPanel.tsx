import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import {
  BrowserSourceRow,
  BrowserSourceKind,
  BrowserSourceTestResult,
  createBrowserSource,
  deleteBrowserSource,
  activateBrowserSource,
  testBrowserSource,
} from '../../api/settings';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Badge } from '@astryxdesign/core/Badge';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { useToast } from '@astryxdesign/core/Toast';
import { MasterDetail } from '../../ui/primitives';

export const BrowserSourcesPanel: React.FC = () => {
  const toast = useToast();
  const { data: sources, refetch } =
    useResource<BrowserSourceRow[]>('/api/settings/browser-sources');

  const [key, setKey] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [kind, setKind] = useState<BrowserSourceKind>('direct_cdp');
  const [host, setHost] = useState<string>('');
  const [port, setPort] = useState<string>('9226');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [sourceToDelete, setSourceToDelete] = useState<BrowserSourceRow | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, BrowserSourceTestResult>>({});

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !label.trim() || !host.trim()) return;
    setSubmitting(true);
    try {
      await createBrowserSource({
        key: key.trim(),
        label: label.trim(),
        kind,
        host: host.trim(),
        port: parseInt(port, 10) || 9226,
        note: note.trim() || undefined,
      });
      setKey('');
      setLabel('');
      setHost('');
      setNote('');
      toast.show({ variant: 'success', title: 'Джерело браузера створено' });
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка створення', description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (row: BrowserSourceRow) => {
    try {
      await activateBrowserSource(row.id);
      toast.show({ variant: 'success', title: `Активовано: ${row.label}` });
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Не вдалося активувати', description: msg });
    }
  };

  const handleTest = async (row: BrowserSourceRow) => {
    setTestingId(row.id);
    try {
      const res = await testBrowserSource(row.id);
      setTestResults((prev) => ({ ...prev, [row.id]: res }));
      if (res.ok) {
        toast.show({ variant: 'success', title: `${row.label}: Доступний! (${res.targets_count} вкладок)` });
      } else {
        toast.show({ variant: 'error', title: `${row.label}: Недоступний`, description: res.detail });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка перевірки', description: msg });
    } finally {
      setTestingId(null);
    }
  };

  const executeDelete = async () => {
    if (!sourceToDelete) return;
    try {
      await deleteBrowserSource(sourceToDelete.id);
      toast.show({ variant: 'info', title: 'Джерело вилучено' });
      setSourceToDelete(null);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Не вдалося вилучити', description: msg });
    }
  };

  const masterList = (
    <div className="flex-col gap-sm">
      {(sources || []).map((s) => {
        const result = testResults[s.id];
        return (
          <Card key={s.id} padding={3}>
            <div className="flex-between mb-xs">
              <span className="text-sm text-bold text-primary">
                {s.label}
              </span>
              <div className="flex-row gap-xs">
                {s.is_active === 1 && <Badge variant="success" label="Активне (Primary)" />}
                <Badge variant="neutral" label={`${s.host}:${s.port}`} />
              </div>
            </div>

            {result && (
              <div className={`text-xs p-xs rounded-sm mb-xs bg-subtle ${result.ok ? 'text-green' : 'text-red'}`}>
                {result.ok ? `✅ Доступно: ${result.targets_count} вкладок` : `❌ ${result.detail}`}
              </div>
            )}

            <div className="flex-row gap-xs justify-end">
              <Button variant="secondary" size="sm" onClick={() => handleTest(s)} disabled={testingId === s.id}>
                {testingId === s.id ? 'Перевірка...' : "Перевірити"}
              </Button>
              {s.is_active !== 1 && (
                <Button variant="primary" size="sm" onClick={() => handleActivate(s)}>
                  Активувати
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={() => setSourceToDelete(s)}>
                ✕
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );

  const formSection = (
    <Card padding={4}>
      <form onSubmit={handleCreate} className="flex-col gap-md">
        <Heading level={3}>
          Додати джерело браузера
        </Heading>

        <TextInput
          label="Ключ джерела (key)"
          value={key}
          onChange={(val) => setKey(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
          placeholder="e.g. laptop_comet"
          required
        />

        <TextInput
          label="Назва (label)"
          value={label}
          onChange={(val) => setLabel(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
          placeholder="e.g. Laptop Comet Browser"
          required
        />

        <Selector
          label="Тип підключення"
          value={kind}
          onChange={(v) => setKind(v as BrowserSourceKind)}
          options={[
            { value: 'direct_cdp', label: 'Прямий CDP (Direct WebSocket)' },
            { value: 'mcp_bridge', label: 'MCP Bridge' },
          ]}
        />

        <TextInput
          label="Хост / IP"
          value={host}
          onChange={(val) => setHost(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
          placeholder="192.168.3.30"
          required
        />

        <TextInput
          label="CDP Порт"
          value={port}
          onChange={(val) => setPort(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
          placeholder="9226"
          required
        />

        <TextInput
          label="Примітка"
          value={note}
          onChange={(val) => setNote(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
          placeholder="Windows 11 portproxy 9226"
        />

        <div className="flex-row justify-end mt-xs">
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? 'Збереження...' : 'Зберегти джерело'}
          </Button>
        </div>
      </form>
    </Card>
  );

  return (
    <VStack gap={4}>
      <MasterDetail master={masterList} detail={formSection} />

      <AlertDialog
        isOpen={Boolean(sourceToDelete)}
        onClose={() => setSourceToDelete(null)}
        title="Видалити джерело браузера?"
        description={`Ви дійсно хочете видалити '${sourceToDelete?.label}'?`}
        confirmLabel="Видалити"
        onConfirm={executeDelete}
      />
    </VStack>
  );
};
