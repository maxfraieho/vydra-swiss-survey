import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { HostRow, ProviderRow, createHost, deleteHost } from '../../api/settings';
import { useIsNarrow } from '../../shell/useIsNarrow';
import { Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from '@astryxdesign/core/Table';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';

export const HostsPanel: React.FC = () => {
  const isNarrow = useIsNarrow();
  const { data: hosts, loading: hostsLoading, error: hostsError, refetch: refetchHosts } =
    useResource<HostRow[]>('/api/settings/hosts');

  const { data: providers } = useResource<ProviderRow[]>('/api/settings/providers');

  const [hostname, setHostname] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [providerId, setProviderId] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState<boolean>(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    setSubmitError(null);

    const trimmedHostname = hostname.trim();
    if (!trimmedHostname) {
      setSubmitError("Будь ласка, вкажіть назву хоста (hostname)");
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
      refetchHosts();
    } catch (err: any) {
      setSubmitError(err?.message || 'Не вдалося створити хост');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (host: HostRow) => {
    if (!window.confirm(`Вилучити хост "${host.hostname}"?`)) {
      return;
    }
    try {
      await deleteHost(host.id);
      refetchHosts();
    } catch (err: any) {
      alert(`Помилка вилучення: ${err?.message || err}`);
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
          <Table hasHover density="compact">
            <TableHeader>
              <TableRow isHeaderRow>
                <TableHeaderCell style={{ width: '50px' }}>ID</TableHeaderCell>
                <TableHeaderCell style={{ width: '140px' }}>Hostname</TableHeaderCell>
                <TableHeaderCell style={{ width: '120px' }}>Label</TableHeaderCell>
                <TableHeaderCell style={{ width: '120px' }}>Провайдер</TableHeaderCell>
                <TableHeaderCell style={{ width: 'auto' }}>Примітка</TableHeaderCell>
                <TableHeaderCell style={{ width: '90px', textAlign: 'right' }}>Дії</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hosts.map((h) => {
                const prov = h.provider_id ? providerMap.get(h.provider_id) : null;
                return (
                  <TableRow key={h.id}>
                    <TableCell style={{ fontFamily: 'monospace', color: 'var(--color-text-disabled)' }}>#{h.id}</TableCell>
                    <TableCell style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{h.hostname}</TableCell>
                    <TableCell style={{ color: 'var(--color-text-secondary)' }}>{h.label || '—'}</TableCell>
                    <TableCell style={{ color: 'var(--color-text-secondary)' }}>
                      {prov ? prov.label || prov.key : h.provider_id ? `#${h.provider_id}` : '—'}
                    </TableCell>
                    <TableCell style={{ color: 'var(--color-text-disabled)', fontSize: '12px', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>{h.note || '—'}</TableCell>
                    <TableCell style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleDelete(h)}
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
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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

        {submitError && (
          <div
            style={{
              padding: '10px 12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--color-border-red)',
              borderRadius: '8px',
              color: 'var(--color-text-red)',
              fontSize: '13px',
            }}
          >
            ⚠️ {submitError}
          </div>
        )}

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
    </VStack>
  );
};
