import React from 'react';
import { useResource } from '../../api/hooks';

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
        <pre
          style={{
            margin: 0,
            fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
            fontSize: '13px',
            lineHeight: '1.6',
            color: '#e2e8f0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#020617',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #1e293b',
          }}
        >
          {reportMd || 'Звіт порожній.'}
        </pre>
      </div>
    </div>
  );
};
