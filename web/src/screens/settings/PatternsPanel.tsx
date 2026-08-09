import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { PatternRow, createPattern, deletePattern } from '../../api/settings';
import { useIsNarrow } from '../../shell/useIsNarrow';

export const PatternsPanel: React.FC = () => {
  const isNarrow = useIsNarrow();
  const { data: patterns, loading: patternsLoading, error: patternsError, refetch: refetchPatterns } =
    useResource<PatternRow[]>('/api/settings/patterns');

  const [key, setKey] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [keywordsText, setKeywordsText] = useState<string>('');
  const [qualifyingPolarity, setQualifyingPolarity] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState<boolean>(false);

  const formatKeywords = (kwStr: string): string => {
    if (!kwStr) return '—';
    try {
      const parsed = JSON.parse(kwStr);
      if (Array.isArray(parsed)) return parsed.join(', ');
    } catch {}
    return kwStr;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    setSubmitError(null);

    const trimmedKey = key.trim();
    if (!trimmedKey) {
      setSubmitError("Будь ласка, вкажіть ключ патерна (key)");
      return;
    }

    const keywordsArray = keywordsText
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    setSubmitting(true);
    try {
      await createPattern({
        key: trimmedKey,
        label: label.trim() || undefined,
        keywords: keywordsArray.length > 0 ? keywordsArray : undefined,
        qualifying_polarity: qualifyingPolarity || undefined,
      });
      setKey('');
      setLabel('');
      setKeywordsText('');
      setQualifyingPolarity('');
      setAttemptedSubmit(false);
      refetchPatterns();
    } catch (err: any) {
      setSubmitError(err?.message || 'Не вдалося створити патерн');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (pattern: PatternRow) => {
    if (pattern.is_builtin === 1) return;
    if (!window.confirm(`Вилучити патерн "${pattern.key}"?`)) {
      return;
    }
    try {
      await deletePattern(pattern.key);
      refetchPatterns();
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
            Патерни ({patterns?.length || 0})
          </h3>
          {patternsLoading && <span style={{ fontSize: '12px', color: '#94a3b8' }}>Завантаження...</span>}
        </div>

        {patternsError && (
          <div style={{ padding: '16px 20px', color: '#f87171', fontSize: '13px' }}>
            ⚠️ Помилка завантаження патернів: {patternsError.message}
          </div>
        )}

        {!patternsLoading && patterns && patterns.length === 0 && (
          <div style={{ padding: '24px 20px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
            Патерни відсутні. Створіть перший патерн за допомогою форми нижче.
          </div>
        )}

        {patterns && patterns.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#020617', borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 14px' }}>Key</th>
                  <th style={{ padding: '10px 14px' }}>Label</th>
                  <th style={{ padding: '10px 14px' }}>Keywords</th>
                  <th style={{ padding: '10px 14px' }}>Polarity</th>
                  <th style={{ padding: '10px 14px' }}>Тип</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Дії</th>
                </tr>
              </thead>
              <tbody>
                {patterns.map((p) => {
                  const isBuiltin = p.is_builtin === 1;
                  return (
                    <tr key={p.id || p.key} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>{p.key}</td>
                      <td style={{ padding: '10px 14px', color: '#f8fafc', fontWeight: 600 }}>{p.label || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#cbd5e1', fontSize: '12px' }}>{formatKeywords(p.keywords)}</td>
                      <td style={{ padding: '10px 14px', color: '#cbd5e1', fontFamily: 'monospace', fontSize: '12px' }}>{p.qualifying_polarity || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {isBuiltin ? (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid #0284c7',
                              textTransform: 'uppercase',
                            }}
                          >
                            вбудований
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(148, 163, 184, 0.15)',
                              color: '#94a3b8',
                              border: '1px solid #475569',
                              textTransform: 'uppercase',
                            }}
                          >
                            користувацький
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          disabled={isBuiltin}
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
                            cursor: isBuiltin ? 'not-allowed' : 'pointer',
                            opacity: isBuiltin ? 0.4 : 1,
                            border: isBuiltin ? '1px solid #334155' : '1px solid #dc2626',
                            background: isBuiltin ? '#1e293b' : 'rgba(239, 68, 68, 0.1)',
                            color: isBuiltin ? '#64748b' : '#f87171',
                          }}
                        >
                          Вилучити
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
          + Додати патерн
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
              placeholder="e.g. tobacco"
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
              Label (Назва)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Тютюн та паління"
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

        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
              Keywords (через кому)
            </label>
            <input
              type="text"
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="e.g. tobacco, smoking, cigarette"
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
              Qualifying Polarity
            </label>
            <select
              value={qualifyingPolarity}
              onChange={(e) => setQualifyingPolarity(e.target.value)}
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
              <option value="">— не вказано —</option>
              <option value="affirm">affirm</option>
              <option value="deny">deny</option>
              <option value="not_fully_healthy">not_fully_healthy</option>
            </select>
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
            {submitting ? 'Збереження...' : 'Створити патерн'}
          </button>
        </div>
      </form>
    </div>
  );
};
