import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { HostRow, ProviderRow, createHost, deleteHost } from '../../api/settings';
import { useIsNarrow } from '../../shell/useIsNarrow';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';

import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { useToast } from '@astryxdesign/core/Toast';

export const HostsPanel: React.FC = () => {
  const isNarrow = useIsNarrow();
  const toast = useToast();
  const { data: hosts, loading: hostsLoading, error: hostsError, refetch: refetchHosts } =
    useResource<HostRow[]>('/api/settings/hosts');

  const { data: providers } = useResource<ProviderRow[]>('/api/settings/providers');

  const [hostname, setHostname] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [providerId, setProviderId] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState<boolean>(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);
  const [hostToDelete, setHostToDelete] = useState<HostRow | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);

    const trimmedHostname = hostname.trim();
    if (!trimmedHostname) {
      return;
    }

    setSubmitting(true);
    try {
      await createHost({
        hostname: trimmedHostname,
        label: label.trim() || undefined,
        provider_id: providerId ? parseInt(providerId, 10) : undefined,
        note: note.trim() || undefined,
      });
      setHostname('');
      setLabel('');
      setProviderId('');
      setNote('');
      setAttemptedSubmit(false);
      toast({ body: 'Збережено' });
      refetchHosts();
    } catch (err: any) {
      toast({ body: err?.message || 'Не вдалося створити хост', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const providerMap = new Map<number, ProviderRow>();
  if (providers) {
    for (const p of providers) {
      providerMap.set(p.id, p);
    }
  }

  return (
    <VStack gap={5}>
      {/* Table Card */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border-emphasized)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Heading level={3} style={{ fontSize: '15px' }}>
            Хости ({hosts?.length || 0})
          </Heading>
          {hostsLoading && <span style={{ fontSize: '12px', color: 'var(--color-text-disabled)' }}>Завантаження...</span>}
        </div>

        {hostsError && (
          <div style={{ padding: '16px 20px', color: 'var(--color-text-red)', fontSize: '13px' }}>
            ⚠️ Помилка завантаження хостів: {hostsError.message}
          </div>
        )}

        {!hostsLoading && hosts && hosts.length === 0 && (
          <div style={{ padding: '24px 20px', color: 'var(--color-text-tertiary)', fontSize: '13px', textAlign: 'center' }}>
            Хости відсутні. Створіть перший хост за допомогою форми нижче.
          </div>
        )}

        {hosts && hosts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
            {hosts.map((h) => {
              const prov = h.provider_id ? providerMap.get(h.provider_id) : null;
              return (
                <Card key={h.id} padding={4}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{h.hostname}</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--color-text-disabled)' }}>#{h.id}</span>
                  </div>
                  <MetadataList columns={1} label={{ position: 'start' }}>
                    <MetadataListItem label="Label">{h.label || '—'}</MetadataListItem>
                    <MetadataListItem label="Провайдер">{prov ? prov.label || prov.key : h.provider_id ? `#${h.provider_id}` : '—'}</MetadataListItem>
                    <MetadataListItem label="Примітка">{h.note || '—'}</MetadataListItem>
                  </MetadataList>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setHostToDelete(h);
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
          + Додати хост
        </Heading>


        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '12px' }}>
          <TextInput
            label="Hostname"
            isRequired
            value={hostname}
            onChange={setHostname}
            placeholder="e.g. example.com"
            status={attemptedSubmit && !hostname.trim() ? { type: 'error', message: "Обов'язкове поле" } : undefined}
          />

          <TextInput
            label="Label (Назва)"
            isOptional
            value={label}
            onChange={setLabel}
            placeholder="e.g. Example Survey Panel"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '12px' }}>
          <Selector
            label="Провайдер"
            value={providerId || undefined}
            onChange={(v) => setProviderId(v || '')}
            placeholder="— без провайдера —"
            options={(providers ?? []).map((p) => ({ value: String(p.id), label: `${p.label} (${p.key})` }))}
          />

          <TextInput
            label="Примітка (Note)"
            isOptional
            value={note}
            onChange={setNote}
            placeholder="Короткий коментар..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <Button
            type="submit"
            variant="primary"
            isDisabled={submitting}
            label={submitting ? 'Збереження...' : 'Створити хост'}
          />
        </div>
      </form>
      </Card>

      <AlertDialog
        isOpen={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={hostToDelete ? `Вилучити хост "${hostToDelete.hostname}"?` : ''}
        description="Цю дію неможливо скасувати."
        actionLabel="Вилучити"
        onAction={async () => {
          if (!hostToDelete) return;
          try {
            await deleteHost(hostToDelete.id);
            toast({ body: 'Вилучено' });
            refetchHosts();
          } catch (err: any) {
            toast({ body: err?.message || 'Не вдалося вилучити хост', type: 'error' });
          } finally {
            setConfirmDeleteOpen(false);
            setHostToDelete(null);
          }
        }}
      />
    </VStack>
  );
};
