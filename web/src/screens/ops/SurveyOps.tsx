import React, { useEffect, useRef, useState } from 'react';
import { apiFetch, getApiBase } from '../../api/client';
import { usePolling } from '../../api/hooks';
import { useIsNarrow } from '../../shell/useIsNarrow';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';

export interface PendingDecision {
  action: string;
  target_text?: string;
  value?: string;
}

export interface PendingTask {
  id: string;
  profile: string;
  profile_name: string;
  url: string;
  reward: string;
  duration: string;
  created_at: string;
  wait_expires_at: string;
  status: string;
}

export interface SurveyStatus {
  status:
    | 'idle'
    | 'waiting_auth'
    | 'starting'
    | 'running'
    | 'waiting_verification'
    | 'finished'
    | 'error';
  active_task_id: string | null;
  profile: string | null;
  url: string | null;
  reward: string | null;
  duration: string | null;
  training_mode: boolean;
  pending_step: number | string | null;
  pending_decision: PendingDecision | null;
  log_history: string[];
  last_error: string | null;
  wait_seconds_remaining: number;
  pending_tasks: PendingTask[];
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  waiting_auth: { bg: 'rgba(245, 158, 11, 0.15)', fg: 'var(--color-text-yellow)' },
  waiting_verification: { bg: 'rgba(168, 85, 247, 0.15)', fg: '#c084fc' },
  running: { bg: 'rgba(99, 102, 241, 0.15)', fg: '#818cf8' },
  starting: { bg: 'rgba(99, 102, 241, 0.15)', fg: '#818cf8' },
  finished: { bg: 'rgba(16, 185, 129, 0.15)', fg: 'var(--color-text-green)' },
  error: { bg: 'rgba(239, 68, 68, 0.15)', fg: 'var(--color-text-red)' },
};

function statusColor(status: string): { bg: string; fg: string } {
  return STATUS_COLORS[status] || { bg: 'rgba(148, 163, 184, 0.15)', fg: 'var(--color-text-disabled)' };
}

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '15px',
  marginBottom: '12px',
};

const buttonStyle: React.CSSProperties = {
  background: '#6366f1',
  color: 'var(--color-text-primary)',
  border: 'none',
  borderRadius: '8px',
  padding: '8px 14px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'var(--color-border)',
};

const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'var(--color-border-red)',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--color-background-page)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  padding: '8px 12px',
  color: 'var(--color-text-primary)',
  fontSize: '13px',
  width: '100%',
  boxSizing: 'border-box',
};

export const SurveyOps: React.FC = () => {
  const isNarrow = useIsNarrow();
  const { data: status, error: statusError } = usePolling<SurveyStatus>('/api/survey/status', {
    intervalMs: 1000,
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = useState('');
  const [overrideExplanation, setOverrideExplanation] = useState('');
  const [countdown, setCountdown] = useState<number>(0);
  const [screenshotTs, setScreenshotTs] = useState<number>(Date.now());
  const [screenshotOk, setScreenshotOk] = useState<boolean>(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  // Client-side countdown timer for waiting_auth window.
  useEffect(() => {
    if (status?.status === 'waiting_auth' && (status.wait_seconds_remaining || 0) > 0) {
      setCountdown(status.wait_seconds_remaining);
    }
  }, [status?.status, status?.wait_seconds_remaining]);

  useEffect(() => {
    if (status?.status !== 'waiting_auth' || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [status?.status, countdown]);

  // Live screenshot polling (~1200ms), independent of status polling.
  useEffect(() => {
    const timer = setInterval(() => {
      setScreenshotTs(Date.now());
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  // Autoscroll system log on update.
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [status?.log_history]);

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await action();
    } catch (err) {
      console.error(`[SurveyOps] action "${key}" failed`, err);
    } finally {
      setBusy(null);
    }
  };

  const handleTrainingModeToggle = (enabled: boolean) => {
    runAction('training_mode', () =>
      apiFetch('/api/survey/training_mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
    );
  };

  const handleFetchTelegram = () => {
    runAction('fetch_telegram', () => apiFetch('/api/survey/fetch_telegram', { method: 'POST' }));
  };

  const handleSelectTask = (taskId: string) => {
    runAction(`select_task:${taskId}`, () =>
      apiFetch('/api/survey/select_task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
      })
    );
  };

  const handleAuthorize = () => {
    runAction('authorize', () => apiFetch('/api/survey/authorize', { method: 'POST' }));
  };

  const handleStop = () => {
    runAction('stop', () => apiFetch('/api/survey/stop', { method: 'POST' }));
  };

  const handleApproveStep = () => {
    runAction('approve_step', () => apiFetch('/api/survey/approve_step', { method: 'POST' }));
  };

  const handleOverrideStep = () => {
    if (!overrideTarget.trim()) return;
    runAction('override_step', async () => {
      await apiFetch('/api/survey/override_step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          override_target: overrideTarget,
          override_action: 'click',
          explanation: overrideExplanation,
        }),
      });
      setOverrideTarget('');
      setOverrideExplanation('');
    });
  };

  const openLiveBrowser = () => {
    window.open('http://192.168.3.184:9226', '_blank');
  };

  const color = statusColor(status?.status || 'idle');
  const screenshotSrc = `${getApiBase()}/api/survey/screenshot/latest?t=${screenshotTs}`;

  return (
    <VStack gap={5}>
      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <Heading level={1} style={{ fontSize: '18px' }}>
          🎓 Режим Навчання — HITL Опитування
        </Heading>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: '999px',
            textTransform: 'uppercase',
            background: color.bg,
            color: color.fg,
          }}
        >
          {status?.status || 'idle'}
        </span>
        {statusError && (
          <span style={{ fontSize: '12px', color: 'var(--color-text-red)' }}>
            Помилка опитування статусу: {statusError.message}
          </span>
        )}
      </div>

      {/* Training mode toggle */}
      <Card padding={4} style={cardStyle}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={Boolean(status?.training_mode)}
            onChange={(e) => handleTrainingModeToggle(e.target.checked)}
            disabled={busy === 'training_mode'}
          />
          🎓 Режим Навчання (Пауза &amp; Коригування)
        </label>
      </Card>

      {/* Queue from Telegram */}
      <Card padding={4}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <Heading level={2} style={sectionTitleStyle}>Черга опитувань з Telegram</Heading>
          <button
            style={secondaryButtonStyle}
            onClick={handleFetchTelegram}
            disabled={busy === 'fetch_telegram'}
          >
            📥 Підтягнути опитування з Telegram
          </button>
        </div>

        {(!status?.pending_tasks || status.pending_tasks.length === 0) && (
          <div style={{ color: 'var(--color-text-tertiary)', fontSize: '13px', padding: '12px 0' }}>
            Черга порожня.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {status?.pending_tasks?.map((task) => (
            <div
              key={task.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--color-background-page)',
                border: '1px solid var(--color-border-emphasized)',
                borderRadius: '8px',
                padding: '10px 14px',
              }}
            >
              <div>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '13px' }}>
                  {task.profile_name} — {task.reward} ({task.duration})
                </div>
                <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px', wordBreak: 'break-all' }}>{task.url}</div>
              </div>
              <button
                style={buttonStyle}
                onClick={() => handleSelectTask(task.id)}
                disabled={busy === `select_task:${task.id}`}
              >
                ⚡ Запустити
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Active task */}
      <Card padding={4}>
        <Heading level={2} style={sectionTitleStyle}>Активне завдання</Heading>
        {!status?.active_task_id && (
          <div style={{ color: 'var(--color-text-tertiary)', fontSize: '13px' }}>Немає активного завдання.</div>
        )}
        {status?.active_task_id && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ color: '#e2e8f0', fontSize: '13px' }}>
              <strong>{status.profile}</strong> — {status.reward} ({status.duration})
            </div>
            {status.url && (
              <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px', wordBreak: 'break-all' }}>{status.url}</div>
            )}

            {status.status === 'waiting_auth' && countdown > 0 && (
              <div style={{ color: 'var(--color-text-yellow)', fontSize: '20px', fontWeight: 700, fontFamily: 'monospace' }}>
                {formatCountdown(countdown)}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button style={buttonStyle} onClick={handleAuthorize} disabled={busy === 'authorize'}>
                ⚡ Авторизувати та Запустити негайно
              </button>
              <button style={dangerButtonStyle} onClick={handleStop} disabled={busy === 'stop'}>
                🛑 Зупинити
              </button>
              <button style={secondaryButtonStyle} onClick={openLiveBrowser}>
                🌐 Live CDP Браузер
              </button>
            </div>
          </div>
        )}
        {status?.last_error && (
          <div style={{ marginTop: '10px', color: 'var(--color-text-red)', fontSize: '12px' }}>
            Помилка: {status.last_error}
          </div>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '20px' }}>
        {/* Live screenshot */}
        <Card padding={4}>
          <Heading level={2} style={sectionTitleStyle}>Живий скріншот</Heading>
          <div
            style={{
              background: 'var(--color-background-page)',
              border: '1px solid var(--color-border-emphasized)',
              borderRadius: '8px',
              minHeight: '280px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {screenshotOk ? (
              <img
                src={screenshotSrc}
                onLoad={() => setScreenshotOk(true)}
                onError={() => setScreenshotOk(false)}
                style={{ maxWidth: '100%', display: 'block' }}
                alt="Живий скріншот опитування"
              />
            ) : (
              <>
                <img
                  src={screenshotSrc}
                  onLoad={() => setScreenshotOk(true)}
                  onError={() => setScreenshotOk(false)}
                  style={{ display: 'none' }}
                  alt=""
                />
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: '13px' }}>
                  Скріншот очікує першого кроку
                </span>
              </>
            )}
          </div>
        </Card>

        {/* Human training panel */}
        <Card padding={4}>
          <Heading level={2} style={sectionTitleStyle}>Панель навчання людини</Heading>

          {status?.pending_decision ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ color: '#c084fc', fontSize: '13px' }}>
                Крок {status.pending_step}: <strong>{status.pending_decision.action?.toUpperCase()}</strong>
              </div>
              {status.pending_decision.target_text && (
                <div style={{ color: '#e2e8f0', fontSize: '13px' }}>
                  Ціль: {status.pending_decision.target_text}
                </div>
              )}
              {status.pending_decision.value && (
                <div style={{ color: '#e2e8f0', fontSize: '13px' }}>
                  Значення: {status.pending_decision.value}
                </div>
              )}

              <button style={buttonStyle} onClick={handleApproveStep} disabled={busy === 'approve_step'}>
                ✅ Затвердити рішення Gemma
              </button>

              <div style={{ height: '1px', background: 'var(--color-background-muted)', margin: '8px 0' }} />

              <input
                type="text"
                placeholder="Точна назва кнопки/пункту"
                value={overrideTarget}
                onChange={(e) => setOverrideTarget(e.target.value)}
                style={inputStyle}
              />
              <textarea
                placeholder="Пояснення правила"
                value={overrideExplanation}
                onChange={(e) => setOverrideExplanation(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <button
                style={secondaryButtonStyle}
                onClick={handleOverrideStep}
                disabled={busy === 'override_step' || !overrideTarget.trim()}
              >
                🎓 Навчити Агента
              </button>
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-tertiary)', fontSize: '13px' }}>
              Немає кроку, що очікує верифікації.
            </div>
          )}
        </Card>
      </div>

      {/* System log */}
      <Card padding={4}>
        <Heading level={2} style={sectionTitleStyle}>Системний лог</Heading>
        <div
          ref={logRef}
          style={{
            background: 'var(--color-background-page)',
            border: '1px solid var(--color-border-emphasized)',
            borderRadius: '8px',
            padding: '10px 12px',
            maxHeight: '220px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: 'var(--color-text-disabled)',
          }}
        >
          {status?.log_history?.length ? (
            status.log_history.map((line, i) => <div key={i}>{line}</div>)
          ) : (
            <div style={{ color: '#475569' }}>Лог порожній.</div>
          )}
        </div>
      </Card>
    </VStack>
  );
};
