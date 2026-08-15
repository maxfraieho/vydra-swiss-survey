import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { HostRow, ProviderRow, createHost, deleteHost } from '../../api/settings';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { useToast } from '@astryxdesign/core/Toast';
import { MasterDetail } from '../../ui/primitives';

export const HostsPanel: React.FC = () => {
  const toast = useToast();
  const { data: hosts, refetch: refetchHosts } = useResource<HostRow[]>('/api/settings/hosts');
  const { data: providers } = useResource<ProviderRow[]>('/api/settings/providers');

  const [hostname, setHostname] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [providerId, setProviderId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [hostToDelete, setHostToDelete] = useState<HostRow | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = hostname.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await createHost({
        hostname: trimmed,
        label: label.trim() || undefined,
        provider_id: providerId ? parseInt(providerId, 10) : undefined,
        note: note.trim() || undefined,
      });
      setHostname('');
      setLabel('');
      setProviderId('');
      setNote('');
      toast.show({ variant: 'success', title: 'Хост створено' });
      refetchHosts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка створення хоста', description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const executeDelete = async () => {
    if (!hostToDelete) return;
    try {
      await deleteHost(hostToDelete.id);
      toast.show({ variant: 'info', title: `Хост '${hostToDelete.hostname}' видалено` });
      setHostToDelete(null);
      refetchHosts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Не вдалося видалити хост', description: msg });
    }
  };

  const providerOptions = [
    { value: '', label: 'Без провайдера' },
    ...(providers || []).map((p) => ({ value: String(p.id), label: `${p.name} (${p.kind})` })),
  ];

  const masterList = (
    <div className="flex-col gap-sm">
      {(hosts || []).map((h) => (
        <Card key={h.id} padding={3}>
          <div className="flex-between">
            <span className="text-sm text-bold text-primary">{h.hostname}</span>
            <Button variant="destructive" size="sm" onClick={() => setHostToDelete(h)}>
              ✕
            </Button>
          </div>
          {h.label && <div className="text-xs text-secondary mt-xs">{h.label}</div>}
        </Card>
      ))}
    </div>
  );

  const formSection = (
    <Card padding={4}>
      <form onSubmit={handleCreate} className="flex-col gap-md">
        <Heading level={3}>
          Додати новий хост
        </Heading>

        <TextInput
          label="Hostname (домен або IP)"
          value={hostname}
          onChange={(val) => setHostname(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
          placeholder="meinungsplatz.ch або opinionhero.com"
          required
        />

        <TextInput
          label="Назва (Label)"
          value={label}
          onChange={(val) => setLabel(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
          placeholder="Meinungsplatz Швейцарія"
        />

        <Selector
          label="Провайдер"
          value={providerId}
          onChange={(v) => setProviderId(v)}
          options={providerOptions}
        />

        <TextInput
          label="Примітка"
          value={note}
          onChange={(val) => setNote(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
          placeholder="Особливості проходження опитування"
        />

        <div className="flex-row justify-end mt-sm">
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? 'Збереження...' : 'Зберегти хост'}
          </Button>
        </div>
      </form>
    </Card>
  );

  return (
    <VStack gap={4}>
      <MasterDetail master={masterList} detail={formSection} />

      <AlertDialog
        isOpen={Boolean(hostToDelete)}
        onClose={() => setHostToDelete(null)}
        title="Видалити хост?"
        description={`Ви дійсно хочете видалити '${hostToDelete?.hostname}'?`}
        confirmLabel="Видалити"
        onConfirm={executeDelete}
      />
    </VStack>
  );
};
