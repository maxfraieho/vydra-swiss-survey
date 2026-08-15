import React from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Link } from 'react-router';
import { SurveyStatusPill } from '../ui/primitives';
import type { SurveyStatus } from '../ui/tokens';

export interface RunItem {
  id: string;
  status: SurveyStatus;
  url: string;
  stepsCount: number;
  createdAt: string;
}

export interface RecentRunsProps {
  runs: RunItem[];
}

export const RecentRuns: React.FC<RecentRunsProps> = ({ runs }) => {
  return (
    <Card padding={3}>
      <div className="flex-between mb-sm">
        <span className="text-sm text-bold text-primary">
          Останні прогони
        </span>
        <Link to="/traces" className="text-xs text-accent no-underline">
          Усі прогони →
        </Link>
      </div>

      <div className="flex-col gap-xs">
        {runs.length === 0 ? (
          <span className="text-xs text-tertiary">
            Немає завершених або активних прогонів
          </span>
        ) : (
          runs.slice(0, 5).map((r) => (
            <Link
              key={r.id}
              to={`/traces/${r.id}`}
              className="flex-between items-center p-xs rounded-md bg-subtle text-primary no-underline"
            >
              <div className="flex-row gap-sm items-center">
                <SurveyStatusPill status={r.status} />
                <span className="text-xs truncate max-w-sm">
                  {r.url || `Прогін #${r.id}`}
                </span>
              </div>
              <span className="text-xs text-tertiary">
                {r.stepsCount} кр.
              </span>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
};
