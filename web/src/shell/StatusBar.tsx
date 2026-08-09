import React, { useEffect } from 'react';
import { Link } from 'react-router';
import { Badge, type BadgeVariant } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { usePolling } from '../api/hooks';
import { useIsNarrow } from './useIsNarrow';

export interface SurveyStatus {
  status: 'idle' | 'waiting_auth' | 'running' | 'waiting_verification' | 'finished' | 'error';
  active_task_id: string | null;
  profile: string | null;
  reward: string | null;
  duration: string | null;
  wait_seconds_remaining?: number;
  pending_step?: number;
  pending_decision?: any;
  pending_tasks?: any[];
}

export const StatusBar: React.FC = () => {
  const isNarrow = useIsNarrow();
  const { data: statusData } = usePolling<SurveyStatus>('/api/survey/status', {
    enabled: true,
    intervalMs: 3000,
  });

  const status = statusData?.status || 'idle';
  const profile = statusData?.profile || null;
  const isWaitingVerification = status === 'waiting_verification';

  useEffect(() => {
    if (isWaitingVerification) {
      document.title = '🔴 [VERIFY] Astryx Survey Console';
    } else if (status === 'running') {
      document.title = '⚡ [RUNNING] Astryx Survey Console';
    } else {
      document.title = 'Astryx Swiss Survey Console';
    }
  }, [status, isWaitingVerification]);

  const getBadgeVariant = (s: SurveyStatus['status']): BadgeVariant => {
    switch (s) {
      case 'waiting_verification':
        return 'error';
      case 'running':
        return 'info';
      case 'waiting_auth':
        return 'warning';
      case 'finished':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'neutral';
    }
  };

  return (
    <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: isNarrow ? '6px 12px' : '8px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ fontSize: '12px', color: '#64748b', minWidth: 0 }}>
          meinungsplatz.ch • SOCKS5 Proxy CH
        </div>

        <Badge
          variant={getBadgeVariant(status)}
          label={`${status}${profile ? ` (${profile})` : ''}`}
        />
      </div>

      {isWaitingVerification && (
        <Banner
          status="error"
          title="⚠️ HITL Verification Required"
          description={`Agent is waiting at step ${statusData?.pending_step || '?'}.`}
          endContent={
            <Button
              as={Link}
              href="/"
              label="До кроку у Режимі Навчання"
              variant="secondary"
            />
          }
        />
      )}
    </div>
  );
};
