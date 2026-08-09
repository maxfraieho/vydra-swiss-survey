import React from 'react';
import { useResource } from '../../api/hooks';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';

export interface TraceData {
  run_id: string;
  host: string;
  persona: string;
  outcome: string;
  steps_json?: any;
  final_text?: string;
  created_at?: string;
}

interface TraceDetailProps {
  runId: string | null;
  onClose?: () => void;
}

export const TraceDetail: React.FC<TraceDetailProps> = ({ runId, onClose }) => {
  const { data: trace, loading, error } = useResource<TraceData>(
    runId ? `/api/traces/${encodeURIComponent(runId)}` : null
  );

  if (!runId) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
        Оберіть прогін (trace) зі списку для перегляду деталей
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
        Завантаження деталей прогону {runId}...
      </div>
    );
  }

  if (error || !trace) {
    return (
      <div style={{ padding: '24px', color: '#f87171', fontSize: '13px' }}>
        Помилка завантаження прогону {runId}: {error?.message || 'Не знайдено'}
      </div>
    );
  }

  let steps: any[] = [];
  if (trace.steps_json) {
    if (typeof trace.steps_json === 'string') {
      try {
        steps = JSON.parse(trace.steps_json);
      } catch {
        steps = [trace.steps_json];
      }
    } else if (Array.isArray(trace.steps_json)) {
      steps = trace.steps_json;
    }
  }

  return (
    <Card padding={5}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
        <div>
          <Text type="supporting" color="secondary">
            Прогін (Trace)
          </Text>
          <Heading level={3} style={{ marginTop: '4px', fontFamily: 'monospace' }}>
            {trace.run_id}
          </Heading>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer', padding: '4px 8px' }}
          >
            ✕
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '4px',
            background: trace.outcome === 'success' || trace.outcome === 'finished' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: trace.outcome === 'success' || trace.outcome === 'finished' ? '#34d399' : '#f87171',
            border: `1px solid ${trace.outcome === 'success' || trace.outcome === 'finished' ? '#059669' : '#dc2626'}`,
          }}
        >
          {trace.outcome || 'unknown'}
        </span>
        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: '#1e293b', color: '#cbd5e1' }}>
          Хост: <strong>{trace.host}</strong>
        </span>
        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: '#1e293b', color: '#cbd5e1' }}>
          Персона: <strong>{trace.persona}</strong>
        </span>
      </div>

      {trace.final_text && (
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
            Фінальний результат (Final Text)
          </span>
          <div style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#e2e8f0' }}>
            {trace.final_text}
          </div>
        </div>
      )}

      <div>
        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
          Кроки виконання ({steps.length})
        </span>

        {steps.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#64748b' }}>Деталі кроків відсутні.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
            {steps.map((step, idx) => (
              <div key={idx} style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: '8px', padding: '10px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>
                  <span>Крок #{idx + 1}</span>
                  {step.action && <span style={{ color: '#38bdf8', fontWeight: 700 }}>{step.action}</span>}
                </div>
                <pre style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {typeof step === 'string' ? step : JSON.stringify(step, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
