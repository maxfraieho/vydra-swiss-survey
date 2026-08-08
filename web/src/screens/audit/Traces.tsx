import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { useResource } from '../../api/hooks';
import { TraceDetail } from './TraceDetail';

export interface TraceSummary {
  run_id: string;
  host: string;
  persona: string;
  outcome: string;
  created_at?: string;
}

export const Traces: React.FC = () => {
  const { runId: routeRunId } = useParams<{ runId?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedRunId, setSelectedRunId] = useState<string | null>(routeRunId || null);

  useEffect(() => {
    if (routeRunId) {
      setSelectedRunId(routeRunId);
    }
  }, [routeRunId]);

  const hostFilter = searchParams.get('host') || '';
  const personaFilter = searchParams.get('persona') || '';
  const outcomeFilter = searchParams.get('outcome') || '';

  const queryParams = new URLSearchParams();
  if (hostFilter) queryParams.set('host', hostFilter);
  if (personaFilter) queryParams.set('persona', personaFilter);
  if (outcomeFilter) queryParams.set('outcome', outcomeFilter);

  const endpoint = `/api/traces?${queryParams.toString()}`;
  const { data: traces, loading, error } = useResource<TraceSummary[]>(endpoint);

  const handleSelectTrace = (runId: string) => {
    setSelectedRunId(runId);
    navigate(`/traces/${encodeURIComponent(runId)}`);
  };

  const updateParam = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Filters Bar */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Фільтр за хостом..."
          value={hostFilter}
          onChange={(e) => updateParam('host', e.target.value)}
          style={{
            background: '#020617',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#f8fafc',
            fontSize: '13px',
          }}
        />

        <select
          value={personaFilter}
          onChange={(e) => updateParam('persona', e.target.value)}
          style={{
            background: '#020617',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#f8fafc',
            fontSize: '13px',
          }}
        >
          <option value="">Усі Персони</option>
          <option value="arno">Arno (Арсен)</option>
          <option value="annette">Annette (Олена)</option>
        </select>

        <select
          value={outcomeFilter}
          onChange={(e) => updateParam('outcome', e.target.value)}
          style={{
            background: '#020617',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#f8fafc',
            fontSize: '13px',
          }}
        >
          <option value="">Усі Результати (Outcomes)</option>
          <option value="finished">Finished</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>

        {(hostFilter || personaFilter || outcomeFilter) && (
          <button
            onClick={() => setSearchParams(new URLSearchParams())}
            style={{
              background: '#334155',
              color: '#f8fafc',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Скинути фільтри
          </button>
        )}
      </div>

      {/* Grid: Table + Side Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedRunId ? '1fr 450px' : '1fr', gap: '20px' }}>
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
              Прогони Агента (Traces) ({traces?.length || 0})
            </h2>
            {loading && <span style={{ fontSize: '12px', color: '#94a3b8' }}>Оновлення...</span>}
          </div>

          {error && (
            <div style={{ padding: '20px', color: '#f87171', fontSize: '13px' }}>
              Помилка завантаження прогонів: {error.message}
            </div>
          )}

          {!loading && traces && traces.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              Жодного прогону не знайдено за обраними фільтрами.
            </div>
          )}

          {traces && traces.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#020617', borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 14px' }}>Run ID</th>
                    <th style={{ padding: '10px 14px' }}>Хост</th>
                    <th style={{ padding: '10px 14px' }}>Персона</th>
                    <th style={{ padding: '10px 14px' }}>Результат (Outcome)</th>
                    <th style={{ padding: '10px 14px' }}>Дата / Час</th>
                  </tr>
                </thead>
                <tbody>
                  {traces.map((t) => {
                    const isSelected = selectedRunId === t.run_id;
                    return (
                      <tr
                        key={t.run_id}
                        onClick={() => handleSelectTrace(t.run_id)}
                        style={{
                          borderBottom: '1px solid #1e293b',
                          cursor: 'pointer',
                          background: isSelected ? '#1e293b' : 'transparent',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>{t.run_id}</td>
                        <td style={{ padding: '10px 14px', color: '#e2e8f0', fontWeight: 600 }}>{t.host}</td>
                        <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>{t.persona}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              textTransform: 'uppercase',
                              background: t.outcome === 'success' || t.outcome === 'finished' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: t.outcome === 'success' || t.outcome === 'finished' ? '#34d399' : '#f87171',
                            }}
                          >
                            {t.outcome || 'unknown'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>{t.created_at || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedRunId && (
          <div>
            <TraceDetail
              runId={selectedRunId}
              onClose={() => {
                setSelectedRunId(null);
                navigate('/traces');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
