import React from 'react';
import { useResource } from '../../api/hooks';
import { Markdown } from '../../ui/Markdown';

export const Report: React.FC = () => {
  const { data: reportMd, loading, error } = useResource<string>('/api/rules/report.md');

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
        Генерація Markdown/Mermaid звіту правил...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#f87171', fontSize: '13px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}>
        Помилка завантаження звіту: {error.message}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
          Звіт про стан системи знань (Knowledge Report)
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
          Згенеровано автоматично через API U0 (<code style={{ color: '#38bdf8' }}>rules_report.py</code>).
        </p>
      </div>

      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
        <div style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: '8px', padding: '20px' }}>
          {reportMd && reportMd.trim() !== '' ? (
            <Markdown source={reportMd} />
          ) : (
            <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>Звіт порожній.</span>
          )}
        </div>
      </div>
    </div>
  );
};
