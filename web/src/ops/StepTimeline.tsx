import React from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';

export interface StepItem {
  index: number;
  action: string;
  target?: string | null;
  status: string;
  timestamp?: string;
  hasCorrection?: boolean;
}

export interface StepTimelineProps {
  currentStep: number;
  totalSteps?: number | null;
  steps: StepItem[];
}

export const StepTimeline: React.FC<StepTimelineProps> = ({
  currentStep,
  totalSteps,
  steps,
}) => {
  const percent = totalSteps && totalSteps > 0 ? Math.min(100, Math.round((currentStep / totalSteps) * 100)) : 0;

  return (
    <Card padding={3}>
      <div className="flex-between mb-sm">
        <span className="text-sm text-bold text-primary">
          Таймлайн кроків
        </span>
        {totalSteps ? (
          <span className="text-xs text-tertiary">
            {currentStep} з {totalSteps} ({percent}%)
          </span>
        ) : (
          <span className="text-xs text-tertiary">
            Крок {currentStep}
          </span>
        )}
      </div>

      {totalSteps && totalSteps > 0 ? (
        <div className="mb-md">
          <ProgressBar progress={percent} />
        </div>
      ) : null}

      <div className="flex-col gap-sm overflow-auto" style={{ maxHeight: '240px' }}>
        {steps.length === 0 ? (
          <div className="text-xs text-tertiary">
            Історія кроків порожня
          </div>
        ) : (
          steps.map((s, idx) => (
            <div
              key={idx}
              className={`flex-between items-center p-xs rounded-md border-default ${s.index === currentStep ? 'bg-subtle' : ''}`}
            >
              <div className="flex-row gap-sm items-center">
                <span className="text-xs text-tertiary">
                  #{s.index}
                </span>
                <span className="text-xs text-semibold text-primary">
                  {s.action}
                </span>
                {s.target && (
                  <span className="text-xs text-secondary truncate max-w-xs">
                    {s.target}
                  </span>
                )}
              </div>
              <div className="flex-row gap-xs items-center">
                {s.hasCorrection && (
                  <Badge variant="warning" label="Правка" />
                )}
                <Badge variant={s.status === 'success' ? 'success' : s.status === 'error' ? 'error' : 'neutral'} label={s.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
