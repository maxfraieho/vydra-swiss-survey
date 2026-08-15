import React from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import type { AgentIntent as AgentIntentType } from '../types/agent';

export interface AgentIntentProps {
  intent?: AgentIntentType | null;
}

export const AgentIntent: React.FC<AgentIntentProps> = ({ intent }) => {
  if (!intent) return null;

  const confidencePercent = Math.round((intent.confidence ?? 1) * 100);
  const isLowConfidence = intent.confidence < 0.6;

  return (
    <Card padding={3}>
      <div className="flex-between mb-sm">
        <div className="flex-row gap-sm items-center">
          <span className="text-xs text-bold text-tertiary text-uppercase">
            Намір агента
          </span>
          <Badge variant={isLowConfidence ? 'warning' : 'info'} label={intent.action.toUpperCase()} />
        </div>
        <div className="flex-row gap-xs items-center">
          <span className={`text-xs ${isLowConfidence ? 'text-yellow' : 'text-secondary'}`}>
            Впевненість: {confidencePercent}%
          </span>
        </div>
      </div>

      <div className="mb-sm">
        <ProgressBar progress={confidencePercent} />
      </div>

      {isLowConfidence && (
        <div className="text-xs text-yellow mb-sm">
          ⚠️ Низька впевненість (&lt;60%) — потрібна верифікація людини.
        </div>
      )}

      {intent.rationale && (
        <div className="text-sm text-primary mb-xs">
          <strong>Обґрунтування:</strong> {intent.rationale}
        </div>
      )}

      {(intent.target_selector || intent.target_text) && (
        <div className="text-xs text-secondary text-mono">
          Ціль: {intent.target_text || intent.target_selector}
        </div>
      )}
    </Card>
  );
};
