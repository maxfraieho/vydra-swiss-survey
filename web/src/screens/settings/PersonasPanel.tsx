import React, { useState, useEffect } from 'react';
import { useResource } from '../../api/hooks';
import { useIsNarrow } from '../../shell/useIsNarrow';
import { PersonaRow, createPersona, updatePersona, deletePersona } from '../../api/settings';
import { Markdown } from '@astryxdesign/core/Markdown';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';

export const PersonasPanel: React.FC = () => {
  const isNarrow = useIsNarrow();
  const { data: personas, loading: personasLoading, error: personasError, refetch: refetchPersonas } =
    useResource<PersonaRow[]>('/api/settings/personas');

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [key, setKey] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [contentMd, setContentMd] = useState<string>('');
  const [active, setActive] = useState<number>(1);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState<boolean>(false);

  // When personas load or selectedKey changes, sync form if editing existing
  const selectedPersona = personas?.find((p) => p.key === selectedKey) || null;

  const handleSelectPersona = (p: PersonaRow) => {
    setSelectedKey(p.key);
    setKey(p.key);
    setLabel(p.label);
    setContentMd(p.content_md || '');
    setActive(p.active);
    setSubmitError(null);
    setAttemptedSubmit(false);
  };

  const handleNewPersona = () => {
    setSelectedKey(null);
    setKey('');
    setLabel('');
    setContentMd('');
    setActive(1);
    setSubmitError(null);
    setAttemptedSubmit(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    setSubmitError(null);

    const trimmedKey = key.trim();
    const trimmedLabel = label.trim();

    const missing: string[] = [];
    if (!selectedKey && !trimmedKey) missing.push('Ключ (key)');
    if (!trimmedLabel) missing.push('Назва (label)');

    if (missing.length > 0) {
      setSubmitError(`Будь ласка, заповніть обов'язкові поля: ${missing.join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      if (selectedKey) {
        // Update existing persona
        await updatePersona(selectedKey, {
          label: trimmedLabel,
          content_md: contentMd,
          active,
        });
      } else {
        // Create new persona
        await createPersona({
          key: trimmedKey,
          label: trimmedLabel,
          content_md: contentMd,
          active,
        });
        setSelectedKey(trimmedKey);
      }
      refetchPersonas();
    } catch (err: any) {
      setSubmitError(err?.message || 'Не вдалося зберегти персону');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedKey) return;
    if (!window.confirm(`Вилучити персону "${selectedKey}"?`)) {
      return;
    }
    setSubmitting(true);
    try {
      await deletePersona(selectedKey);
      handleNewPersona();
      refetchPersonas();
    } catch (err: any) {
      setSubmitError(err?.message || 'Не вдалося вилучити персону');
    } finally {
      setSubmitting(false);
    }
  };

  const charCount = contentMd.length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '320px 1fr', gap: '20px' }}>
      {/* Left Column: Cards List */}
      <Card
        padding={4}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxHeight: '800px',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Heading level={3} style={{ fontSize: '15px' }}>
            Персони ({personas?.length || 0})
          </Heading>
          <Button type="button" variant="secondary" label="+ Нова" onClick={handleNewPersona} />
        </div>

        {personasLoading && <div style={{ color: 'var(--color-text-disabled)', fontSize: '13px' }}>Завантаження...</div>}

        {personasError && (
          <div style={{ color: 'var(--color-text-red)', fontSize: '13px' }}>
            ⚠️ {personasError.message}
          </div>
        )}

        {personas && personas.length === 0 && !personasLoading && (
          <div style={{ color: 'var(--color-text-tertiary)', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
            Персони відсутні.
          </div>
        )}

        {personas?.map((p) => {
          const isSelected = selectedKey === p.key;
          return (
            <div
              key={p.key}
              onClick={() => handleSelectPersona(p)}
              style={{
                background: isSelected ? 'var(--color-background-muted)' : 'var(--color-background-page)',
                border: isSelected ? '1px solid var(--color-accent)' : '1px solid var(--color-border-emphasized)',
                borderRadius: '8px',
                padding: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '13px', fontFamily: 'monospace' }}>
                  {p.key}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    background: p.active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                    color: p.active ? 'var(--color-text-green)' : '#9ca3af',
                  }}
                >
                  {p.active ? 'Активна' : 'Неактивна'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{p.label}</div>
            </div>
          );
        })}
      </Card>

      {/* Right Column: Persona Editor */}
      <Card padding={5}>
      <form
        onSubmit={handleSave}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-emphasized)', paddingBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
              {selectedKey ? 'Редагування' : 'Створення'}
            </span>
            <Heading level={3} style={{ marginTop: '2px', fontSize: '16px' }}>
              {selectedKey ? `Персона: ${selectedKey}` : 'Нова персона'}
            </Heading>
          </div>
          {selectedKey && (
            <Button type="button" variant="destructive" label="Вилучити персону" onClick={handleDelete} />
          )}
        </div>

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

        {/* Form Inputs: Key, Label, Active */}
        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr 120px', gap: '12px' }}>
          <TextInput
            label="Key (Ідентифікатор)"
            isRequired
            value={key}
            onChange={setKey}
            isDisabled={Boolean(selectedKey)}
            placeholder="e.g. swiss_resident"
            status={attemptedSubmit && !key.trim() && !selectedKey ? { type: 'error', message: "Обов'язкове поле" } : undefined}
          />

          <TextInput
            label="Label (Назва)"
            isRequired
            value={label}
            onChange={setLabel}
            placeholder="e.g. Swiss Resident (DE/FR/IT)"
            status={attemptedSubmit && !label.trim() ? { type: 'error', message: "Обов'язкове поле" } : undefined}
          />

          <Selector
            label="Статус"
            value={String(active)}
            onChange={(v) => setActive(parseInt(v || '1', 10))}
            options={[
              { value: '1', label: 'Активна' },
              { value: '0', label: 'Неактивна' },
            ]}
          />
        </div>

        {/* Content Markdown Textarea */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <TextArea
            label="Опис персони (Markdown content)"
            value={contentMd}
            onChange={setContentMd}
            placeholder="Введіть опис персони у форматі Markdown..."
            rows={8}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '11px', color: 'var(--color-text-disabled)' }}>
            {charCount} символів
          </div>
        </div>

        {/* Live Preview Block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-disabled)' }}>
            Попередній перегляд Markdown
          </label>
          <Card
            variant="muted"
            padding={4}
            style={{
              minHeight: '60px',
              maxHeight: '300px',
              overflowY: 'auto',
            }}
          >
            {contentMd && contentMd.trim() !== '' ? (
              <Markdown headingLevelStart={4}>{contentMd}</Markdown>
            ) : (
              <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic', fontSize: '13px' }}>
                Попередній перегляд з'явиться тут при введенні тексту...
              </span>
            )}
          </Card>
        </div>

        {/* Submit row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
          <Button
            type="submit"
            variant="primary"
            isDisabled={submitting}
            label={submitting ? 'Збереження...' : selectedKey ? 'Зберегти зміни' : 'Створити персону'}
          />
        </div>
      </form>
      </Card>
    </div>
  );
};
