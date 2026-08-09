import React, { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useResource } from '../../api/hooks';
import { RuleRow } from './RulesTable';
import { Markdown } from '../../ui/Markdown';

export interface CompareResult {
  pattern: string;
  count: number;
  rules: RuleRow[];
}

export const Compare: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const patternParam = searchParams.get('pattern') || '';
  const [inputPattern, setInputPattern] = useState(patternParam);

  const endpoint = patternParam ? `/api/rules/compare?pattern=${encodeURIComponent(patternParam)}` : null;
  const { data, loading, error } = useResource<CompareResult>(endpoint);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPattern.trim()) {
      setSearchParams({ pattern: inputPattern.trim() });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
          Порівняння патернів правил (Compare)
        </h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>
          Порівняйте поведінку одного патерну між різними хостами, профайлами та джерелами.
        </p>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="Введіть exact pattern (наприклад: q_income_swiss)..."
            value={inputPattern}
            onChange={(e) => setInputPattern(e.target.value)}
            style={{
              flex: 1,
              background: '#020617',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#f8fafc',
              fontSize: '13px',
            }}
          />
          <button
            type="submit"
            style={{
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Порівняти
          </button>
        </form>
      </div>

      {loading && (
        <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          Завантаження порівняння для "{patternParam}"...
        </div>
      )}

      {error && (
        <div style={{ padding: '20px', color: '#f87171', fontSize: '13px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}>
          Помилка порівняння: {error.message}
        </div>
      )}

      {!patternParam && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}>
          💡 Введіть назву патерну у полі вище для порівняння.
        </div>
      )}

      {data && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
              Результати для патерну "{data.pattern}" ({data.count} правил)
            </h3>
          </div>

          {data.rules.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              Жодного правила не знайдено для цього патерну.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#020617', borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 14px' }}>ID</th>
                    <th style={{ padding: '10px 14px' }}>Хост</th>
                    <th style={{ padding: '10px 14px' }}>Персона</th>
                    <th style={{ padding: '10px 14px' }}>Поведінка (Behavior)</th>
                    <th style={{ padding: '10px 14px' }}>Джерело</th>
                    <th style={{ padding: '10px 14px' }}>Статус</th>
                    <th style={{ padding: '10px 14px' }}>Ефект</th>
                    <th style={{ padding: '10px 14px' }}>Conf</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rules.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#94a3b8' }}>#{r.id}</td>
                      <td style={{ padding: '10px 14px', color: '#e2e8f0', fontWeight: 600 }}>{r.host}</td>
                      <td style={{ padding: '10px 14px', color: '#e2e8f0' }}>{r.persona}</td>
                      <td style={{ padding: '10px 14px' }}><Markdown source={r.behavior} variant="compact" /></td>
                      <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>{r.source}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            background: r.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: r.status === 'active' ? '#34d399' : '#fbbf24',
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {r.effective ? (
                          <span style={{ fontSize: '11px', color: '#60a5fa' }}>✅ win</span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#f87171' }}>⚠️ #{r.shadowed_by}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#cbd5e1' }}>{r.confidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
