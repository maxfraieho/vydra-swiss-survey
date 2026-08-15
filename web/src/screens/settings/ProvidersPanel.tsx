import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { ProviderRow, createProvider, deleteProvider } from '../../api/settings';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { MasterDetail, normalizeInputChange, useToast } from '../../ui/primitives';

export const ProvidersPanel: React.FC = () => {
  const toast = useToast();
  const { data: providers, refetch: refetchProviders } =
    useResource<ProviderRow[]>('/api/settings/providers');

  const [key, setKey] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [urlPattern, setUrlPattern] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [providerToDelete, setProviderToDelete] = useState<ProviderRow | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedKey = key.trim();
    const trimmedLabel = label.trim();
    if (!trimmedKey || !trimmedLabel) return;

    setSubmitting(true);
    try {
      await createProvider({
        key: trimmedKey,
        label: trimmedLabel,
        url_pattern: urlPattern.trim() || undefined,
        note: note.trim() || undefined,
      });
      setKey('');
      setLabel('');
      setUrlPattern('');
      setNote('');
      toast.show({ variant: 'success', title: 'Провайдера створено' });
      refetchProviders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка створення провайдера', description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const executeDelete = async () => {
    if (!providerToDelete) return;
    try {
      await deleteProvider(providerToDelete.id);
      toast.show({ variant: 'info', title: `Провайдера '${providerToDelete.key}' видалено` });
      setProviderToDelete(null);
      refetchProviders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Не вдалося видалити провайдера', description: msg });
    }
  };

  const masterList = (
    <div className="flex-col gap-sm">
      {(providers || []).map((p) => (
        <Card key={p.id} padding={3}>
          <div className="flex-between">
            <div className="flex-col gap-xs">
              <span className="text-sm text-bold text-primary">{p.label}</span>
              <span className="text-xs text-accent text-mono">{p.key}</span>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setProviderToDelete(p)}>
              ✕
            </Button>
          </div>
          {p.url_pattern && <div className="text-xs text-secondary mt-xs">{p.url_pattern}</div>}
        </Card>
      ))}
    </div>
  );

  const formSection = (
    <Card padding={4}>
      <form onSubmit={handleCreate} className="flex-col gap-md">
        <Heading level={3}>
          Додати нового провайдера
        </Heading>

        <TextInput
          label="Ключ провайдера (key)"
          value={key}
          onChange={(val) => setKey(normalizeInputChange(val))}
          placeholder="e.g. cint або dynata"
          required
        />

        <TextInput
          label="Назва (Label)"
          value={label}
          onChange={(val) => setLabel(normalizeInputChange(val))}
          placeholder="Cint Survey Provider"
          required
        />

        <TextInput
          label="URL Pattern (RegExp/Substring)"
          value={urlPattern}
          onChange={(val) => setUrlPattern(normalizeInputChange(val))}
          placeholder="cint.com"
        />

        <TextInput
          label="Примітка"
          value={note}
          onChange={(val) => setNote(normalizeInputChange(val))}
          placeholder="Особливості інтеграції"
        />

        <div className="flex-row justify-end mt-sm">
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? 'Збереження...' : 'Зберегти провайдера'}
          </Button>
        </div>
      </form>
    </Card>
  );

  return (
    <VStack gap={4}>
      <MasterDetail master={masterList} detail={formSection} />

      <AlertDialog
        isOpen={Boolean(providerToDelete)}
        onClose={() => setProviderToDelete(null)}
        title="Видалити провайдера?"
        description={`Ви дійсно хочете видалити '${providerToDelete?.label}'?`}
        confirmLabel="Видалити"
        onConfirm={executeDelete}
      />
    </VStack>
  );
};
