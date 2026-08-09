import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { ProviderRow, createProvider, deleteProvider } from '../../api/settings';
import { useIsNarrow } from '../../shell/useIsNarrow';
import { Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from '@astryxdesign/core/Table';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Button } from '@astryxdesign/core/Button';

export const ProvidersPanel: React.FC = () => {
  const isNarrow = useIsNarrow();
  const { data: providers, loading: providersLoading, error: providersError, refetch: refetchProviders } =
    useResource<ProviderRow[]>('/api/settings/providers');

  const [key, setKey] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [urlPattern, setUrlPattern] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState<boolean>(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    setSubmitError(null);

    const trimmedKey = key.trim();
    const trimmedLabel = label.trim();

    const missing: string[] = [];
    if (!trimmedKey) missing.push('Ключ (key)');
    if (!trimmedLabel) missing.push('Назва (label)');

    if (missing.length > 0) {
      setSubmitError(`Будь ласка, заповніть обов'язкові поля: ${missing.join(', ')}`);
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
      refetchProviders();
    } catch (err: any) {
      setSubmitError(err?.message || 'Не вдалося створити провайдера');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (prov: ProviderRow) => {
    if (!window.confirm(`Вилучити провайдера "${prov.label}" (${prov.key})?`)) {
      return;
    }
    try {
      await deleteProvider(prov.id);
      refetchProviders();
    } catch (err: any) {
      alert(`Помилка вилучення: ${err?.message || err}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Table Card */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
            Провайдери ({providers?.length || 0})
          </h3>
          {providersLoading && <span style={{ fontSize: '12px', color: '#94a3b8' }}>Завантаження...</span>}
        </div>

        {providersError && (
          <div style={{ padding: '16px 20px', color: '#f87171', fontSize: '13px' }}>
            ⚠️ Помилка завантаження провайдерів: {providersError.message}
          </div>
        )}

        {!providersLoading && providers && providers.length === 0 && (
          <div style={{ padding: '24px 20px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
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
                  <TableCell style={{ fontFamily: 'monospace', color: '#94a3b8' }}>#{p.id}</TableCell>
                  <TableCell style={{ fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>{p.key}</TableCell>
                  <TableCell style={{ color: '#f8fafc', fontWeight: 600 }}>{p.label}</TableCell>
                  <TableCell style={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'normal', wordBreak: 'break-all' }}>{p.url_pattern || '—'}</TableCell>
                  <TableCell style={{ color: '#94a3b8', fontSize: '12px', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>{p.note || '—'}</TableCell>
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
                        border: '1px solid #dc2626',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#f87171',
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
      </div>

      {/* Creation Form Card */}
      <form
        onSubmit={handleCreate}
        style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
          + Додати провайдера
        </h4>

        {submitError && (
          <div
            style={{
              padding: '10px 12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #dc2626',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '13px',
            }}
          >
            ⚠️ {submitError}
          </div>
        )}

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
    </div>
  );
};
