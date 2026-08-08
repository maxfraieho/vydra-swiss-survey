import React, { useEffect } from 'react';
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

  const getStatusColor = () => {
    switch (status) {
      case 'waiting_verification':
        return '#ef4444';
      case 'running':
        return '#3b82f6';
      case 'waiting_auth':
        return '#f59e0b';
      case 'finished':
        return '#10b981';
      case 'error':
        return '#f43f5e';
      default:
        return '#6b7280';
    }
  };

  return (
    <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: isNarrow ? '10px 12px' : '12px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              flexShrink: 0,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '18px',
            }}
          >
            A
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: isNarrow ? '6px' : '8px' }}>
              <span style={{ fontWeight: 700, fontSize: isNarrow ? '14px' : '16px', color: '#f8fafc' }}>
                Astryx Swiss Survey Console
              </span>
              <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#1e293b', color: '#94a3b8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                /app (U2)
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              meinungsplatz.ch • SOCKS5 Proxy CH
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', background: '#1e293b', padding: '6px 14px', borderRadius: '8px', border: '1px solid #334155' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: getStatusColor(),
                boxShadow: isWaitingVerification ? '0 0 8px #ef4444' : 'none',
              }}
            />
            <span style={{ color: '#e2e8f0', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
              {status}
            </span>
            {profile && <span style={{ color: '#94a3b8', fontSize: '11px' }}>({profile})</span>}
          </div>
        </div>
      </div>

      {isWaitingVerification && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 16px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '13px',
          }}
        >
          <div>
            <strong>⚠️ HITL Verification Required:</strong> Agent is waiting at step {statusData?.pending_step || '?'}.
          </div>
          <a
            href="/"
            style={{
              background: '#ef4444',
              color: '#fff',
              padding: '4px 12px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            → До кроку у Режимі Навчання (/)
          </a>
        </div>
      )}
    </div>
  );
};
