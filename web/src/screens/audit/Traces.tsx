import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { useResource } from '../../api/hooks';
import { useIsNarrow } from '../../shell/useIsNarrow';
import { TraceDetail } from './TraceDetail';
import { Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from '@astryxdesign/core/Table';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';

export interface TraceSummary {
  run_id: string;
  host: string;
  persona: string;
  outcome: string;
  created_at?: string;
}

export const Traces: React.FC = () => {
  const isNarrow = useIsNarrow();
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
    <VStack gap={5}>
      {/* Filters Bar */}
      <Card padding={4}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Фільтр за хостом..."
          value={hostFilter}
          onChange={(e) => updateParam('host', e.target.value)}
          style={{
            background: 'var(--color-background-page)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
          }}
        />

        <select
          value={personaFilter}
          onChange={(e) => updateParam('persona', e.target.value)}
          style={{
            background: 'var(--color-background-page)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--color-text-primary)',
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
            background: 'var(--color-background-page)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--color-text-primary)',
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
              background: 'var(--color-border)',
              color: 'var(--color-text-primary)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Скинути фільтри
          </button>
        )}
      </div>
      </Card>

      {/* Grid: Table + Side Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : (selectedRunId ? '1fr 450px' : '1fr'), gap: '20px' }}>
        <Card padding={0}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border-emphasized)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Heading level={2} style={{ fontSize: '15px' }}>
              Прогони Агента (Traces) ({traces?.length || 0})
            </Heading>
            {loading && <span style={{ fontSize: '12px', color: 'var(--color-text-disabled)' }}>Оновлення...</span>}
          </div>

          {error && (
            <div style={{ padding: '20px', color: 'var(--color-text-red)', fontSize: '13px' }}>
              Помилка завантаження прогонів: {error.message}
            </div>
          )}

          {!loading && traces && traces.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '13px' }}>
              Жодного прогону не знайдено за обраними фільтрами.
            </div>
          )}

          {traces && traces.length > 0 && (
            <Table hasHover density="compact">
              <TableHeader>
                <TableRow isHeaderRow>
                  <TableHeaderCell style={{ width: '160px' }}>Run ID</TableHeaderCell>
                  <TableHeaderCell style={{ width: '110px' }}>Хост</TableHeaderCell>
                  <TableHeaderCell style={{ width: '90px' }}>Персона</TableHeaderCell>
                  <TableHeaderCell style={{ width: '100px' }}>Результат (Outcome)</TableHeaderCell>
                  <TableHeaderCell style={{ width: 'auto' }}>Дата / Час</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {traces.map((t) => {
                  const isSelected = selectedRunId === t.run_id;
                  return (
                    <TableRow
                      key={t.run_id}
                      onClick={() => handleSelectTrace(t.run_id)}
                      style={{ cursor: 'pointer', background: isSelected ? 'var(--color-background-muted)' : undefined }}
                    >
                      <TableCell style={{ fontFamily: 'monospace', color: 'var(--color-accent)', fontWeight: 600, whiteSpace: 'normal', wordBreak: 'break-all' }}>{t.run_id}</TableCell>
                      <TableCell style={{ color: '#e2e8f0', fontWeight: 600 }}>{t.host}</TableCell>
                      <TableCell style={{ color: 'var(--color-text-secondary)' }}>{t.persona}</TableCell>
                      <TableCell>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            background: t.outcome === 'success' || t.outcome === 'finished' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: t.outcome === 'success' || t.outcome === 'finished' ? 'var(--color-text-green)' : 'var(--color-text-red)',
                          }}
                        >
                          {t.outcome || 'unknown'}
                        </span>
                      </TableCell>
                      <TableCell style={{ color: 'var(--color-text-tertiary)', fontSize: '12px' }}>{t.created_at || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

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
    </VStack>
  );
};
