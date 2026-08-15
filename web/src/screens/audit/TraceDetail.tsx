import React from 'react';
import { useResource } from '../../api/hooks';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Badge } from '@astryxdesign/core/Badge';
import { Card } from '@astryxdesign/core/Card';
import { OutcomePill } from '../../ui/primitives';
import type { RunOutcome } from '../../ui/tokens';

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
  const { data: trace, loading } = useResource<TraceData>(
    runId ? `/api/traces/${encodeURIComponent(runId)}` : null
  );

  let steps: any[] = [];
  if (trace?.steps_json) {
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
    <Dialog
      isOpen={runId !== null}
      onClose={onClose || (() => {})}
    >
      <DialogHeader
        title={trace ? `Прогін #${trace.run_id}` : runId || 'Деталі прогону'}
      />

      {loading && (
        <div className="p-lg text-center text-xs text-tertiary">
          Завантаження деталей прогону {runId}...
        </div>
      )}

      {trace && (
        <div className="flex-col gap-md">
          <div className="flex-row flex-wrap gap-sm items-center">
            <OutcomePill outcome={trace.outcome as RunOutcome} />
            <Badge variant="neutral" label={`Хост: ${trace.host}`} />
            <Badge variant="neutral" label={`Персона: ${trace.persona}`} />
          </div>

          {trace.final_text && (
            <Card padding={3}>
              <span className="text-xs text-tertiary text-bold block mb-xs">
                Фінальний результат (Final Text)
              </span>
              <div className="text-xs text-primary p-sm bg-subtle rounded-md border-default">
                {trace.final_text}
              </div>
            </Card>
          )}

          <div>
            <span className="text-xs text-tertiary text-bold block mb-xs">
              Кроки виконання ({steps.length})
            </span>

            {steps.length === 0 ? (
              <div className="text-xs text-tertiary">Деталі кроків відсутні.</div>
            ) : (
              <div className="flex-col gap-sm overflow-auto" style={{ maxHeight: '360px' }}>
                {steps.map((step, idx) => (
                  <div key={idx} className="p-sm bg-subtle rounded-md border-default text-xs">
                    <div className="flex-between text-tertiary mb-xs">
                      <span>Крок #{idx + 1}</span>
                      <span>{step.action || 'action'}</span>
                    </div>
                    <div className="text-primary text-mono">
                      {typeof step === 'string' ? step : JSON.stringify(step)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
};
