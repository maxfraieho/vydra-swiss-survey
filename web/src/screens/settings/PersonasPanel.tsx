import React, { useState, useEffect } from 'react';
import { useResource } from '../../api/hooks';
import { PersonaRow, createPersona, updatePersona, deletePersona } from '../../api/settings';
import { Markdown } from '../../ui/Markdown';

export const PersonasPanel: React.FC = () => {
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
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
      {/* Left Column: Cards List */}
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxHeight: '800px',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
            Персони ({personas?.length || 0})
          </h3>
          <button
            type="button"
            onClick={handleNewPersona}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid #38bdf8',
              background: '#1e293b',
              color: '#38bdf8',
            }}
          >
            + Нова
          </button>
        </div>

        {personasLoading && <div style={{ color: '#94a3b8', fontSize: '13px' }}>Завантаження...</div>}

        {personasError && (
          <div style={{ color: '#f87171', fontSize: '13px' }}>
            ⚠️ {personasError.message}
          </div>
        )}

        {personas && personas.length === 0 && !personasLoading && (
          <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
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
                background: isSelected ? '#1e293b' : '#020617',
                border: isSelected ? '1px solid #38bdf8' : '1px solid #1e293b',
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
                <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '13px', fontFamily: 'monospace' }}>
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
                    color: p.active ? '#34d399' : '#9ca3af',
                  }}
                >
                  {p.active ? 'Активна' : 'Неактивна'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e1' }}>{p.label}</div>
            </div>
          );
        })}
      </div>

      {/* Right Column: Persona Editor */}
      <form
        onSubmit={handleSave}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              {selectedKey ? 'Редагування' : 'Створення'}
            </span>
            <h3 style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
              {selectedKey ? `Персона: ${selectedKey}` : 'Нова персона'}
            </h3>
          </div>
          {selectedKey && (
            <button
              type="button"
              onClick={handleDelete}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid #dc2626',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#f87171',
              }}
            >
              Вилучити персону
            </button>
          )}
        </div>

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

        {/* Form Inputs: Key, Label, Active */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
              Key (Ідентифікатор) <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={Boolean(selectedKey)}
              placeholder="e.g. swiss_resident"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: selectedKey ? '#090d16' : '#020617',
                border: attemptedSubmit && !key.trim() && !selectedKey ? '1px solid #f87171' : '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 12px',
                color: selectedKey ? '#94a3b8' : '#f8fafc',
                fontSize: '13px',
                outline: 'none',
                fontFamily: 'monospace',
                cursor: selectedKey ? 'not-allowed' : 'text',
              }}
            />
            {attemptedSubmit && !key.trim() && !selectedKey && (
              <span style={{ fontSize: '11px', color: '#f87171' }}>Обов'язкове поле</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
              Label (Назва) <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Swiss Resident (DE/FR/IT)"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#020617',
                border: attemptedSubmit && !label.trim() ? '1px solid #f87171' : '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            {attemptedSubmit && !label.trim() && (
              <span style={{ fontSize: '11px', color: '#f87171' }}>Обов'язкове поле</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
              Статус
            </label>
            <select
              value={active}
              onChange={(e) => setActive(parseInt(e.target.value, 10))}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value={1}>Активна</option>
              <option value={0}>Неактивна</option>
            </select>
          </div>
        </div>

        {/* Content Markdown Textarea */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
            Опис персони (Markdown content)
          </label>
          <textarea
            value={contentMd}
            onChange={(e) => setContentMd(e.target.value)}
            placeholder="Введіть опис персони у форматі Markdown..."
            rows={8}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#020617',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '10px 12px',
              color: '#f8fafc',
              fontSize: '13px',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '11px', color: '#94a3b8' }}>
            {charCount} символів
          </div>
        </div>

        {/* Live Preview Block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
            Попередній перегляд Markdown
          </label>
          <div
            style={{
              background: '#020617',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '12px 16px',
              minHeight: '60px',
              maxHeight: '300px',
              overflowY: 'auto',
            }}
          >
            {contentMd && contentMd.trim() !== '' ? (
              <Markdown source={contentMd} />
            ) : (
              <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>
                Попередній перегляд з'явиться тут при введенні тексту...
              </span>
            )}
          </div>
        </div>

        {/* Submit row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1,
              border: '1px solid #38bdf8',
              background: '#1e293b',
              color: '#38bdf8',
              transition: 'all 0.15s ease',
            }}
          >
            {submitting ? 'Збереження...' : selectedKey ? 'Зберегти зміни' : 'Створити персону'}
          </button>
        </div>
      </form>
    </div>
  );
};
