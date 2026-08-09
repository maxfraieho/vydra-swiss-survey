import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { ProviderRow, createProvider, deleteProvider } from '../../api/settings';
import { useIsNarrow } from '../../shell/useIsNarrow';

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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#020617', borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 14px' }}>ID</th>
                  <th style={{ padding: '10px 14px' }}>Key</th>
                  <th style={{ padding: '10px 14px' }}>Label</th>
                  <th style={{ padding: '10px 14px' }}>URL Pattern</th>
                  <th style={{ padding: '10px 14px' }}>Примітка</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Дії</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#94a3b8' }}>#{p.id}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>{p.key}</td>
                    <td style={{ padding: '10px 14px', color: '#f8fafc', fontWeight: 600 }}>{p.label}</td>
                    <td style={{ padding: '10px 14px', color: '#cbd5e1', fontFamily: 'monospace', fontSize: '12px' }}>{p.url_pattern || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '12px' }}>{p.note || '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
              Key (Ідентифікатор) <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. qualtrics"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#020617',
                border: attemptedSubmit && !key.trim() ? '1px solid #f87171' : '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            {attemptedSubmit && !key.trim() && (
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
              placeholder="e.g. Qualtrics Surveys"
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
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
              URL Pattern <span style={{ fontWeight: 400, color: '#64748b' }}>(необов'язково)</span>
            </label>
            <input
              type="text"
              value={urlPattern}
              onChange={(e) => setUrlPattern(e.target.value)}
              placeholder="e.g. %qualtrics.com%"
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
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
              Примітка (Note)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Короткий коментар..."
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
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '8px 18px',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
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
            {submitting ? 'Збереження...' : 'Створити провайдера'}
          </button>
        </div>
      </form>
    </div>
  );
};
