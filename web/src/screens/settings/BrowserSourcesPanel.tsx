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
import { useIsNarrow } from '../../shell/useIsNarrow';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Badge } from '@astryxdesign/core/Badge';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { useToast } from '@astryxdesign/core/Toast';

export const BrowserSourcesPanel: React.FC = () => {
  const isNarrow = useIsNarrow();
  const toast = useToast();
  const { data: sources, loading, error, refetch } =
    useResource<BrowserSourceRow[]>('/api/settings/browser-sources');

  const [key, setKey] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [kind, setKind] = useState<BrowserSourceKind>('direct_cdp');
  const [host, setHost] = useState<string>('');
  const [port, setPort] = useState<string>('9226');
  const [mcpServer, setMcpServer] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState<boolean>(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);
  const [sourceToDelete, setSourceToDelete] = useState<BrowserSourceRow | null>(null);

  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, BrowserSourceTestResult>>({});

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);

    const trimmedKey = key.trim();
    const trimmedLabel = label.trim();
    const trimmedHost = host.trim();
    if (!trimmedKey || !trimmedLabel || !trimmedHost || !port.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      await createBrowserSource({
        key: trimmedKey,
        label: trimmedLabel,
        kind,
        host: trimmedHost,
        port: parseInt(port, 10),
        mcp_server: kind === 'mcp_bridge' ? mcpServer.trim() || undefined : undefined,
        note: note.trim() || undefined,
      });
      setKey('');
      setLabel('');
      setKind('direct_cdp');
      setHost('');
      setPort('9226');
      setMcpServer('');
      setNote('');
      setAttemptedSubmit(false);
      toast({ body: 'Збережено' });
      refetch();
    } catch (err: any) {
      toast({ body: err?.message || 'Не вдалося створити джерело браузера', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (row: BrowserSourceRow) => {
    setActivatingId(row.id);
    try {
      await activateBrowserSource(row.id);
      toast({ body: `Активовано: ${row.label}` });
      refetch();
    } catch (err: any) {
      toast({ body: err?.message || 'Не вдалося активувати джерело', type: 'error' });
    } finally {
      setActivatingId(null);
    }
  };

  const handleTest = async (row: BrowserSourceRow) => {
    setTestingId(row.id);
    try {
      const res = await testBrowserSource(row.id);
      setTestResults((prev) => ({ ...prev, [row.id]: res }));
      toast({ body: res.ok ? 'З\'єднання доступне' : 'З\'єднання недоступне', type: res.ok ? undefined : 'error' });
    } catch (err: any) {
      const res = { ok: false, detail: err?.message || 'Помилка перевірки' };
      setTestResults((prev) => ({ ...prev, [row.id]: res }));
      toast({ body: res.detail, type: 'error' });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <VStack gap={5}>
      {/* Table Card */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border-emphasized)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
              🌐 ДОСТУП ДО ІНТЕРНЕТУ
            </span>
            <Heading level={3} style={{ marginTop: '4px', fontSize: '15px' }}>
              Джерела браузера (CDP) ({sources?.length || 0})
            </Heading>
          </div>
          {loading && <span style={{ fontSize: '12px', color: 'var(--color-text-disabled)' }}>Завантаження...</span>}
        </div>

        {error && (
          <div style={{ padding: '16px 20px', color: 'var(--color-text-red)', fontSize: '13px' }}>
            ⚠️ Помилка завантаження джерел: {error.message}
          </div>
        )}

        {!loading && sources && sources.length === 0 && (
          <div style={{ padding: '24px 20px', color: 'var(--color-text-tertiary)', fontSize: '13px', textAlign: 'center' }}>
            Джерела браузера відсутні. Додайте перше за допомогою форми нижче.
          </div>
        )}

        {sources && sources.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
            {sources.map((s) => {
              const result = testResults[s.id];
              return (
                <Card key={s.id} padding={4}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{s.label}</span>
                      {s.is_active === 1 && <Badge variant="success" label="Активне" />}
                      <Badge
                        variant="neutral"
                        label={s.kind === 'mcp_bridge' ? 'MCP-міст' : 'Прямий CDP'}
                      />
                    </div>
                    <span style={{ fontFamily: 'monospace', color: 'var(--color-text-disabled)' }}>#{s.id}</span>
                  </div>
                  <MetadataList columns={1} label={{ position: 'start' }}>
                    <MetadataListItem label="Ключ">{s.key}</MetadataListItem>
                    <MetadataListItem label="Адреса">{s.host}:{s.port}</MetadataListItem>
                    {s.kind === 'mcp_bridge' && (
                      <MetadataListItem label="MCP-інструмент">{s.mcp_server || '—'}</MetadataListItem>
                    )}
                    <MetadataListItem label="Примітка">{s.note || '—'}</MetadataListItem>
                  </MetadataList>

                  {result && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${result.ok ? 'var(--color-border-green, #10b981)' : 'var(--color-border-red, #ef4444)'}`,
                        background: result.ok ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '12px', color: result.ok ? 'var(--color-text-green)' : 'var(--color-text-red)', marginBottom: '4px' }}>
                        {result.ok ? '✅ Доступне' : '❌ Недоступне'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                        {result.detail}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      isDisabled={testingId === s.id}
                      onClick={() => handleTest(s)}
                      label={testingId === s.id ? 'Перевірка...' : "Перевірити з'єднання"}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      isDisabled={s.is_active === 1 || activatingId === s.id}
                      onClick={() => handleActivate(s)}
                      label={s.is_active === 1 ? 'Активне' : activatingId === s.id ? 'Активація...' : 'Активувати'}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSourceToDelete(s);
                        setConfirmDeleteOpen(true);
                      }}
                      style={{
                        padding: '4px 10px',
                        minHeight: '44px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: '1px solid var(--color-border-red)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: 'var(--color-text-red)',
                      }}
                    >
                      Вилучити
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      {/* Creation Form Card */}
      <Card padding={5}>
        <form
          onSubmit={handleCreate}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <Heading level={4} style={{ fontSize: '14px' }}>
            + Додати джерело браузера
          </Heading>

          <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '12px' }}>
            <TextInput
              label="Ключ (key)"
              isRequired
              value={key}
              onChange={setKey}
              placeholder="e.g. swiss_perplexity_comet"
              status={attemptedSubmit && !key.trim() ? { type: 'error', message: "Обов'язкове поле" } : undefined}
            />
            <TextInput
              label="Назва (Label)"
              isRequired
              value={label}
              onChange={setLabel}
              placeholder="e.g. Swiss Perplexity Comet (.30)"
              status={attemptedSubmit && !label.trim() ? { type: 'error', message: "Обов'язкове поле" } : undefined}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr 1fr', gap: '12px' }}>
            <Selector
              label="Тип"
              value={kind}
              onChange={(v) => setKind((v as BrowserSourceKind) || 'direct_cdp')}
              options={[
                { value: 'direct_cdp', label: 'Прямий CDP (SSH-тунель)' },
                { value: 'mcp_bridge', label: 'MCP-міст (LAN, без тунелю)' },
              ]}
            />
            <TextInput
              label="Хост"
              isRequired
              value={host}
              onChange={setHost}
              placeholder="e.g. 192.168.3.30"
              status={attemptedSubmit && !host.trim() ? { type: 'error', message: "Обов'язкове поле" } : undefined}
            />
            <TextInput
              label="Порт (CDP)"
              isRequired
              value={port}
              onChange={setPort}
              placeholder="9226"
              status={attemptedSubmit && !port.trim() ? { type: 'error', message: "Обов'язкове поле" } : undefined}
            />
          </div>

          {kind === 'mcp_bridge' && (
            <TextInput
              label="MCP-інструмент(и)"
              isOptional
              value={mcpServer}
              onChange={setMcpServer}
              placeholder="e.g. comet-win,browser-harness-win"
            />
          )}

          <TextInput
            label="Примітка (Note)"
            isOptional
            value={note}
            onChange={setNote}
            placeholder="Короткий коментар..."
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <Button
              type="submit"
              variant="primary"
              isDisabled={submitting}
              label={submitting ? 'Збереження...' : 'Додати джерело'}
            />
          </div>
        </form>
      </Card>

      <AlertDialog
        isOpen={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={sourceToDelete ? `Вилучити джерело "${sourceToDelete.label}"?` : ''}
        description="Цю дію неможливо скасувати."
        actionLabel="Вилучити"
        onAction={async () => {
          if (!sourceToDelete) return;
          try {
            await deleteBrowserSource(sourceToDelete.id);
            toast({ body: 'Вилучено' });
            refetch();
          } catch (err: any) {
            toast({ body: err?.message || 'Не вдалося вилучити джерело', type: 'error' });
          } finally {
            setConfirmDeleteOpen(false);
            setSourceToDelete(null);
          }
        }}
      />
    </VStack>
  );
};
