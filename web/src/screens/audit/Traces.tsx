import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { useResource } from '../../api/hooks';
import { TraceDetail } from './TraceDetail';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Selector } from '@astryxdesign/core/Selector';
import { PageHeader, EmptyState, OutcomePill } from '../../ui/primitives';
import type { RunOutcome } from '../../ui/tokens';

export interface TraceSummary {
  run_id: string;
  host: string;
  persona: string;
  outcome: string;
  created_at?: string;
  has_human_corrections?: boolean;
}

export const Traces: React.FC = () => {
  const { runId: routeRunId } = useParams<{ runId?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedRunId, setSelectedRunId] = useState<string | null>(routeRunId || null);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  useEffect(() => {
    if (routeRunId) {
      setSelectedRunId(routeRunId);
    }
  }, [routeRunId]);

  const hostFilter = searchParams.get('host') || '';
  const personaFilter = searchParams.get('persona') || '';
  const outcomeFilter = searchParams.get('outcome') || '';
  const humanOnlyFilter = searchParams.get('human_only') === 'true';

  const queryParams = new URLSearchParams();
  if (hostFilter) queryParams.set('host', hostFilter);
  if (personaFilter) queryParams.set('persona', personaFilter);
  if (outcomeFilter) queryParams.set('outcome', outcomeFilter);

  const endpoint = `/api/traces?${queryParams.toString()}`;
  const { data: traces, loading } = useResource<TraceSummary[]>(endpoint);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  };

  const handleSelectTrace = (runId: string) => {
    setSelectedRunId(runId);
    navigate(`/traces/${encodeURIComponent(runId)}`);
  };

  const toggleCompare = (runId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedForCompare((prev) =>
      prev.includes(runId) ? prev.filter((id) => id !== runId) : prev.length < 2 ? [...prev, runId] : [prev[1], runId]
    );
  };

  const filteredTraces = (traces || []).filter((t) => {
    if (humanOnlyFilter && !t.has_human_corrections) return false;
    return true;
  });

  return (
    <VStack gap={4}>
      <PageHeader
        eyebrow="АУДИТ"
        title="Прогони опитувань (Traces)"
        subtitle="Історія виконання сесій та аналіз правок людини"
        actions={
          selectedForCompare.length === 2 ? (
            <Button
              variant="primary"
              onClick={() => navigate(`/rules/compare?run1=${selectedForCompare[0]}&run2=${selectedForCompare[1]}`)}
            >
              ⚖️ Порівняти вибрані 2 прогони
            </Button>
          ) : undefined
        }
      />

      <Card padding={3}>
        <div className="flex-row flex-wrap gap-sm items-center">
          <input
            type="text"
            placeholder="Фільтр за хостом..."
            value={hostFilter}
            onChange={(e) => updateParam('host', e.target.value)}
            className="input-standard min-w-0 max-w-xs"
          />

          <Selector
            label=""
            value={personaFilter || 'all'}
            onChange={(v) => updateParam('persona', v)}
            options={[
              { value: 'all', label: 'Усі персони' },
              { value: 'arno', label: 'Arno (Арсен)' },
              { value: 'annet', label: 'Annette (Олена)' },
            ]}
          />

          <Selector
            label=""
            value={outcomeFilter || 'all'}
            onChange={(v) => updateParam('outcome', v)}
            options={[
              { value: 'all', label: 'Усі результати' },
              { value: 'success', label: 'Успіх (success)' },
              { value: 'finished', label: 'Завершено (finished)' },
              { value: 'failed', label: 'Помилка (failed)' },
              { value: 'stopped', label: 'Зупинено (stopped)' },
            ]}
          />

          <label className="flex-row items-center gap-xs text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={humanOnlyFilter}
              onChange={(e) => updateParam('human_only', e.target.checked ? 'true' : '')}
            />
            Тільки з правками людини
          </label>
        </div>
      </Card>

      {filteredTraces.length === 0 ? (
        <Card padding={4}>
          <EmptyState
            title="Прогонів не знайдено"
            description="Спробуйте змінити критерії фільтрації або запустіть нове опитування на пульті."
          />
        </Card>
      ) : (
        <div className="flex-col gap-sm">
          {filteredTraces.map((trace) => {
            const isCompared = selectedForCompare.includes(trace.run_id);
            return (
              <Card key={trace.run_id} padding={3}>
                <div
                  onClick={() => handleSelectTrace(trace.run_id)}
                  className="flex-between flex-wrap gap-sm cursor-pointer"
                >
                  <div className="flex-row items-center gap-sm">
                    <input
                      type="checkbox"
                      checked={isCompared}
                      onClick={(e) => toggleCompare(trace.run_id, e)}
                      onChange={() => {}}
                    />
                    <OutcomePill outcome={trace.outcome as RunOutcome} />
                    <span className="text-sm text-bold text-primary">
                      {trace.host}
                    </span>
                    <Badge variant="neutral" label={trace.persona} />
                    {trace.has_human_corrections && (
                      <Badge variant="warning" label="Урок для тутора" />
                    )}
                  </div>

                  <span className="text-xs text-tertiary">
                    {trace.created_at || trace.run_id}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selectedRunId && (
        <TraceDetail
          runId={selectedRunId}
          onClose={() => {
            setSelectedRunId(null);
            navigate('/traces');
          }}
        />
      )}
    </VStack>
  );
};
