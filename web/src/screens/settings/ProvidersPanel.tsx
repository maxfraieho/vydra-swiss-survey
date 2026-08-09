import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { ProviderRow, createProvider, deleteProvider } from '../../api/settings';
import { useIsNarrow } from '../../shell/useIsNarrow';
import { Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from '@astryxdesign/core/Table';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { useToast } from '@astryxdesign/core/Toast';

export const ProvidersPanel: React.FC = () => {
  const isNarrow = useIsNarrow();
  const toast = useToast();
  const { data: providers, loading: providersLoading, error: providersError, refetch: refetchProviders } =
    useResource<ProviderRow[]>('/api/settings/providers');

  const [key, setKey] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [urlPattern, setUrlPattern] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState<boolean>(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);
  const [providerToDelete, setProviderToDelete] = useState<ProviderRow | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);

    const trimmedKey = key.trim();
    const trimmedLabel = label.trim();

    const missing: string[] = [];
    if (!trimmedKey) missing.push('Ключ (key)');
    if (!trimmedLabel) missing.push('Назва (label)');

    if (missing.length > 0) {
      return;
    }

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
      setAttemptedSubmit(false);
      toast({ body: 'Збережено' });
      refetchProviders();
    } catch (err: any) {
      toast({ body: err?.message || 'Не вдалося створити провайдера', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (prov: ProviderRow) => {
    setProviderToDelete(prov);
    setConfirmDeleteOpen(true);
  };

  return (
    <VStack gap={5}>
      {/* Table Card */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border-emphasized)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Heading level={3} style={{ fontSize: '15px' }}>
            Провайдери ({providers?.length || 0})
          </Heading>
          {providersLoading && <span style={{ fontSize: '12px', color: 'var(--color-text-disabled)' }}>Завантаження...</span>}
        </div>

        {providersError && (
          <div style={{ padding: '16px 20px', color: 'var(--color-text-red)', fontSize: '13px' }}>
            ⚠️ Помилка завантаження провайдерів: {providersError.message}
          </div>
        )}

        {!providersLoading && providers && providers.length === 0 && (
          <div style={{ padding: '24px 20px', color: 'var(--color-text-tertiary)', fontSize: '13px', textAlign: 'center' }}>
            Провайдери відсутні. Створіть першого провайдера за допомогою форми нижче.
          </div>
        )}

        {providers && providers.length > 0 && (
          <Table hasHover density="compact">
            <TableHeader>
              <TableRow isHeaderRow>
                <TableHeaderCell style={{ width: '50px' }}>ID</TableHeaderCell>
                <TableHeaderCell style={{ width: '100px' }}>Key</TableHeaderCell>
                <TableHeaderCell style={{ width: '130px' }}>Label</TableHeaderCell>
                <TableHeaderCell style={{ width: '140px' }}>URL Pattern</TableHeaderCell>
                <TableHeaderCell style={{ width: 'auto' }}>Примітка</TableHeaderCell>
                <TableHeaderCell style={{ width: '90px', textAlign: 'right' }}>Дії</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell style={{ fontFamily: 'monospace', color: 'var(--color-text-disabled)' }}>#{p.id}</TableCell>
                  <TableCell style={{ fontFamily: 'monospace', color: 'var(--color-accent)', fontWeight: 600 }}>{p.key}</TableCell>
                  <TableCell style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{p.label}</TableCell>
                  <TableCell style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'normal', wordBreak: 'break-all' }}>{p.url_pattern || '—'}</TableCell>
                  <TableCell style={{ color: 'var(--color-text-disabled)', fontSize: '12px', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>{p.note || '—'}</TableCell>
                  <TableCell style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
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
              ))}
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
          + Додати провайдера
        </Heading>


        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '12px' }}>
          <TextInput
            label="Key (Ідентифікатор)"
            isRequired
            value={key}
            onChange={setKey}
            placeholder="e.g. qualtrics"
            status={attemptedSubmit && !key.trim() ? { type: 'error', message: "Обов'язкове поле" } : undefined}
          />

          <TextInput
            label="Label (Назва)"
            isRequired
            value={label}
            onChange={setLabel}
            placeholder="e.g. Qualtrics Surveys"
            status={attemptedSubmit && !label.trim() ? { type: 'error', message: "Обов'язкове поле" } : undefined}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '12px' }}>
          <TextInput
            label="URL Pattern"
            isOptional
            value={urlPattern}
            onChange={setUrlPattern}
            placeholder="e.g. %qualtrics.com%"
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
            label={submitting ? 'Збереження...' : 'Створити провайдера'}
          />
        </div>
      </form>
      </Card>

      <AlertDialog
        isOpen={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={providerToDelete ? `Вилучити провайдера "${providerToDelete.label}" (${providerToDelete.key})?` : ''}
        description="Цю дію неможливо скасувати."
        actionLabel="Вилучити"
        onAction={async () => {
          if (!providerToDelete) return;
          try {
            await deleteProvider(providerToDelete.id);
            toast({ body: 'Вилучено' });
            refetchProviders();
          } catch (err: any) {
            toast({ body: err?.message || 'Не вдалося вилучити провайдера', type: 'error' });
          } finally {
            setConfirmDeleteOpen(false);
            setProviderToDelete(null);
          }
        }}
      />
    </VStack>
  );
};
