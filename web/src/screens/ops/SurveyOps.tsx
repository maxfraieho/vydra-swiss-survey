import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { apiFetch, getApiBase } from '../../api/client';
import { usePolling, useResource } from '../../api/hooks';
import { HostGateData } from '../../api/rules';
import { BrowserSourceRow } from '../../api/settings';
import { RuleRow } from '../rules/RulesTable';
import { RuleComposer } from '../rules/RuleComposer';
import { useIsNarrow } from '../../shell/useIsNarrow';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { useToast } from '@astryxdesign/core/Toast';

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

export interface TutorActivity {
  last_action_source: 'human_override' | 'shadow_rule' | 'active_rule' | 'vision_model' | 'idle';
  tutor_explanation: string;
  matched_rule?: {
    pattern: string;
    behavior: string;
    status: string;
    confidence: number;
    host?: string;
  } | null;
  promotion_info?: {
    unique_runs: number;
    target_runs: number;
  } | null;
  updated_at?: string | null;
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
  pending_pattern?: string | null;
  pending_page_text?: string | null;
  log_history: string[];
  last_error: string | null;
  wait_seconds_remaining: number;
  pending_tasks: PendingTask[];
  tutor_activity?: TutorActivity | null;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  waiting_auth: { bg: 'rgba(245, 158, 11, 0.15)', fg: 'var(--color-text-yellow)' },
  waiting_verification: { bg: 'rgba(168, 85, 247, 0.15)', fg: '#c084fc' },
  running: { bg: 'rgba(99, 102, 241, 0.15)', fg: '#818cf8' },
  starting: { bg: 'rgba(99, 102, 241, 0.15)', fg: '#818cf8' },
  finished: { bg: 'rgba(16, 185, 129, 0.15)', fg: 'var(--color-text-green)' },
  error: { bg: 'rgba(239, 68, 68, 0.15)', fg: 'var(--color-text-red)' },
};

const PERSONA_LABELS: Record<string, string> = {
  arno: 'Арсен',
  annet: 'Олена',
};

function formatPersonaName(key: string | null | undefined): string {
  if (!key) return '';
  const lower = key.toLowerCase();
  return PERSONA_LABELS[lower] ? `${PERSONA_LABELS[lower]} (${key})` : key;
}

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

const getHostFromUrl = (urlStr: string | null): string => {
  if (!urlStr) return '';
  try {
    const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    return parsed.hostname;
  } catch {
    return urlStr.replace(/^https?:\/\//, '').split('/')[0] || '';
  }
};

export const SurveyOps: React.FC = () => {
  const isNarrow = useIsNarrow();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: status, error: statusError } = usePolling<SurveyStatus>('/api/survey/status', {
    intervalMs: 1000,
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [resumeProfile, setResumeProfile] = useState<'arno' | 'annet'>('arno');
  const [resumeUrl, setResumeUrl] = useState<string>('');
  const [overrideAction, setOverrideAction] = useState<'click' | 'type' | 'scroll'>('click');
  const [overrideTarget, setOverrideTarget] = useState('');
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideExplanation, setOverrideExplanation] = useState('');
  const [countdown, setCountdown] = useState<number>(0);
  const [verifCountdown, setVerifCountdown] = useState<number>(300);
  const lastPendingStepRef = useRef<number | string | null>(null);
  const [screenshotTs, setScreenshotTs] = useState<number>(Date.now());
  const [screenshotOk, setScreenshotOk] = useState<boolean>(false);
  const [ruleComposerOpen, setRuleComposerOpen] = useState<boolean>(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  const activeHost = getHostFromUrl(status?.url || null);
  const { data: gateData, refetch: refetchGate } = useResource<HostGateData>(
    activeHost ? `/api/gate/${encodeURIComponent(activeHost)}` : null
  );

  const stepRulesEndpoint = activeHost
    ? `/api/rules?host=${encodeURIComponent(activeHost)}${
        status?.profile ? `&persona=${encodeURIComponent(status.profile)}` : ''
      }`
    : null;
  const { data: stepRules } = useResource<RuleRow[]>(stepRulesEndpoint);

  const { data: browserSources } = useResource<BrowserSourceRow[]>('/api/settings/browser-sources');
  const activeBrowserSource = browserSources?.find((s) => s.is_active === 1) || null;

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

  // Client-side countdown timer for step verification deadline (300s default wait).
  useEffect(() => {
    if (status?.pending_decision && status.pending_step !== lastPendingStepRef.current) {
      lastPendingStepRef.current = status.pending_step;
      setVerifCountdown(300);
    }
  }, [status?.pending_decision, status?.pending_step]);

  useEffect(() => {
    if (!status?.pending_decision || verifCountdown <= 0) return;
    const timer = setInterval(() => {
      setVerifCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [status?.pending_decision, verifCountdown]);

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
    } catch (err: any) {
      console.error(`[SurveyOps] action "${key}" failed`, err);
      toast({ body: err?.message || `Помилка виконання дії (${key})`, type: 'error' });
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
    runAction('fetch_telegram', async () => {
      const res = await apiFetch('/api/survey/fetch_telegram', { method: 'POST' });
      const processed = (res as any)?.processed ?? 0;
      toast({ body: processed > 0 ? `Оброблено нових: ${processed}` : 'Нових опитувань немає' });
    });
  };

  const handleDeleteTask = (taskId: string) => {
    if (!confirm('Видалити це завдання з черги?')) return;
    runAction(`delete_task:${taskId}`, () =>
      apiFetch(`/api/survey/pending_tasks/${taskId}`, { method: 'DELETE' })
    );
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

  const handleResumeTab = () => {
    if (!resumeUrl.trim()) return;
    runAction('resume_tab', () =>
      apiFetch('/api/survey/resume_tab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: resumeProfile, tab_url: resumeUrl.trim() }),
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
    if (!overrideTarget.trim() && overrideAction !== 'scroll') return;
    runAction('override_step', async () => {
      const payload: Record<string, any> = {
        override_target: overrideTarget.trim(),
        override_action: overrideAction,
        explanation: overrideExplanation.trim(),
      };
      if (overrideValue.trim()) {
        payload.override_value = overrideValue.trim();
      }
      await apiFetch('/api/survey/override_step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast({ body: 'Корекцію збережено в сигналі (shadow)' });
    });
  };

  const openLiveBrowser = () => {
    if (!activeBrowserSource) {
      toast({ body: 'Активне джерело браузера не налаштовано (Налаштування → Браузер)', type: 'error' });
      return;
    }
    window.open(`http://${activeBrowserSource.host}:${activeBrowserSource.port}`, '_blank');
  };

  const color = statusColor(status?.status || 'idle');
  const screenshotSrc = `${getApiBase()}/api/survey/screenshot/latest?t=${screenshotTs}`;

  return (
    <VStack gap={5}>
      {/* Header with Status & Host Playbook Mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <Heading level={1} style={{ fontSize: '18px' }}>
          🎓 Режим Навчання — HITL Опитування
        </Heading>
        <span
          style={{
            fontSize: '12px',
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

        {/* Host & Playbook Mode Badges */}
        {activeHost && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Link
              to={`/gate/${encodeURIComponent(activeHost)}`}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'var(--color-background-muted)',
                color: 'var(--color-accent)',
                textDecoration: 'none',
              }}
              title="Перейти до гейта хоста"
            >
              🌐 {activeHost}
            </Link>
            {gateData && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  textTransform: 'uppercase',
                  background:
                    gateData.playbook_mode === 'active'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : gateData.playbook_mode === 'shadow'
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(107, 114, 128, 0.15)',
                  color:
                    gateData.playbook_mode === 'active'
                      ? 'var(--color-text-green)'
                      : gateData.playbook_mode === 'shadow'
                      ? 'var(--color-text-yellow)'
                      : '#9ca3af',
                  border: `1px solid ${
                    gateData.playbook_mode === 'active'
                      ? '#059669'
                      : gateData.playbook_mode === 'shadow'
                      ? '#d97706'
                      : '#4b5563'
                  }`,
                }}
                title={`Режим гейта для ${activeHost}`}
              >
                GATE: {gateData.playbook_mode.toUpperCase()}
              </span>
            )}
          </div>
        )}

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

      {/* Tutor Live Activity Card */}
      {status?.training_mode && status.tutor_activity && (
        <Card padding={4} style={{ border: '1px solid #6366f1', background: 'rgba(99, 102, 241, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <Heading level={2} style={{ fontSize: '14px', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🎓 Активність Тутора Навчання
            </Heading>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '999px',
                textTransform: 'uppercase',
                background:
                  status.tutor_activity.last_action_source === 'human_override'
                    ? 'rgba(16, 185, 129, 0.2)'
                    : status.tutor_activity.last_action_source === 'shadow_rule'
                    ? 'rgba(245, 158, 11, 0.2)'
                    : status.tutor_activity.last_action_source === 'active_rule'
                    ? 'rgba(99, 102, 241, 0.2)'
                    : 'rgba(148, 163, 184, 0.2)',
                color:
                  status.tutor_activity.last_action_source === 'human_override'
                    ? '#34d399'
                    : status.tutor_activity.last_action_source === 'shadow_rule'
                    ? '#fbbf24'
                    : status.tutor_activity.last_action_source === 'active_rule'
                    ? '#818cf8'
                    : '#94a3b8',
              }}
            >
              {status.tutor_activity.last_action_source === 'human_override'
                ? '🟢 Human Override'
                : status.tutor_activity.last_action_source === 'shadow_rule'
                ? '🟡 Shadow Rule (Learning)'
                : status.tutor_activity.last_action_source === 'active_rule'
                ? '🔵 Active Rule'
                : status.tutor_activity.last_action_source === 'vision_model'
                ? '🟣 Vision Model'
                : '⚪ Tutor Ready'}
            </span>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', marginBottom: '8px' }}>
            {status.tutor_activity.tutor_explanation}
          </div>

          {status.tutor_activity.matched_rule && (
            <div style={{ fontSize: '12px', background: 'var(--color-background-page)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', marginTop: '6px' }}>
              <div><strong>Патерн:</strong> <code>{status.tutor_activity.matched_rule.pattern}</code></div>
              <div><strong>Поведінка:</strong> {status.tutor_activity.matched_rule.behavior}</div>
              <div><strong>Статус правила:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 600, color: status.tutor_activity.matched_rule.status === 'active' ? '#34d399' : '#fbbf24' }}>{status.tutor_activity.matched_rule.status}</span></div>
            </div>
          )}

          {status.tutor_activity.promotion_info && (
            <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
              📊 Прогрес промоції правила: {status.tutor_activity.promotion_info.unique_runs} / {status.tutor_activity.promotion_info.target_runs} унікальних прогонів
            </div>
          )}

          {/* Interactive Tutor HITL Panel */}
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              style={buttonStyle}
              onClick={handleApproveStep}
              disabled={busy === 'approve_step' || !status?.pending_decision}
            >
              ✅ Підтвердити крок агента
            </button>
            <button
              style={secondaryButtonStyle}
              onClick={() => {
                const el = document.getElementById('override-target-input');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              ✏️ Внести корекцію тутора
            </button>
            <button
              style={secondaryButtonStyle}
              onClick={handleFetchTelegram}
              disabled={busy === 'fetch_telegram'}
            >
              🔄 Оновити статус тутора
            </button>
          </div>
        </Card>
      )}

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
                  Опитування для: {formatPersonaName(task.profile_name || task.profile)} — {task.reward} ({task.duration})
                </div>
                <div style={{ color: 'var(--color-text-tertiary)', fontSize: '12px', wordBreak: 'break-all' }}>{task.url}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  style={buttonStyle}
                  onClick={() => handleSelectTask(task.id)}
                  disabled={busy === `select_task:${task.id}`}
                >
                  ⚡ Запустити
                </button>
                <button
                  style={dangerButtonStyle ?? secondaryButtonStyle}
                  onClick={() => handleDeleteTask(task.id)}
                  disabled={busy === `delete_task:${task.id}`}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Resume in existing tab */}
      <Card padding={4}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <Heading level={2} style={sectionTitleStyle}>🔗 Продовжити в існуючій вкладці</Heading>
        </div>
        <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', gap: '10px', alignItems: isNarrow ? 'stretch' : 'center' }}>
          <select
            value={resumeProfile}
            onChange={(e) => setResumeProfile(e.target.value as 'arno' | 'annet')}
            style={{
              background: 'var(--color-background-page)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '8px 10px',
              color: 'var(--color-text-primary)',
              fontSize: '13px',
              minWidth: '150px',
            }}
          >
            <option value="arno">{formatPersonaName('arno')}</option>
            <option value="annet">{formatPersonaName('annet')}</option>
          </select>

          <input
            type="text"
            placeholder="URL відкритої вкладки (напр. https://meinungsplatz.ch/...)"
            value={resumeUrl}
            onChange={(e) => setResumeUrl(e.target.value)}
            style={inputStyle}
          />

          <button
            style={{
              ...buttonStyle,
              whiteSpace: 'nowrap',
            }}
            onClick={handleResumeTab}
            disabled={busy === 'resume_tab' || !resumeUrl.trim()}
          >
            ▶️ Продовжити в цій вкладці
          </button>
        </div>
      </Card>

      {/* Active task */}
      <Card padding={4}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <Heading level={2} style={sectionTitleStyle}>Активне завдання</Heading>
          {activeHost && gateData && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: gateData.playbook_mode === 'active' ? 'var(--color-text-green)' : 'var(--color-text-yellow)',
              }}
            >
              Гейт хоста: <strong>{gateData.playbook_mode.toUpperCase()}</strong> ({activeHost})
            </span>
          )}
        </div>

        {!status?.active_task_id && (
          <div style={{ color: 'var(--color-text-tertiary)', fontSize: '13px' }}>Немає активного завдання.</div>
        )}
        {status?.active_task_id && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ color: '#e2e8f0', fontSize: '13px' }}>
              Опитування для: <strong>{formatPersonaName(status.profile)}</strong> — {status.reward} ({status.duration})
            </div>
            {status.url && (
              <div style={{ color: 'var(--color-text-tertiary)', fontSize: '12px', wordBreak: 'break-all' }}>{status.url}</div>
            )}

            {status.status === 'waiting_auth' && countdown > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ color: 'var(--color-text-yellow)', fontSize: '13px', fontWeight: 600 }}>
                  ⏳ Очікування авторизації (вікно 10 хв)
                </div>
                <div style={{ color: 'var(--color-text-yellow)', fontSize: '20px', fontWeight: 700, fontFamily: 'monospace' }}>
                  {formatCountdown(countdown)}
                </div>
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
        {/* Live screenshot & Question text */}
        <Card padding={4}>
          <Heading level={2} style={sectionTitleStyle}>Живий скріншот &amp; Текст кроку</Heading>
          <div
            style={{
              position: 'relative',
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
            <img
              src={screenshotSrc}
              onLoad={() => setScreenshotOk(true)}
              onError={() => setScreenshotOk(false)}
              style={{
                maxWidth: '100%',
                display: screenshotOk ? 'block' : 'none',
              }}
              alt="Живий скріншот опитування"
            />
            {!screenshotOk && (
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: '13px' }}>
                Скріншот очікує першого кроку
              </span>
            )}
          </div>

          {/* A2: pending_page_text next to / below screenshot */}
          {status?.pending_page_text && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 14px',
                background: 'var(--color-background-page)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--color-text-primary)',
                lineHeight: '1.4',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>
                📄 Текст питання / сторінки (pending_page_text)
              </div>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {status.pending_page_text}
              </div>
            </div>
          )}
        </Card>

        {/* Human training panel */}
        <Card padding={4}>
          <Heading level={2} style={sectionTitleStyle}>Панель навчання людини</Heading>

          {status?.pending_decision || status?.pending_pattern || overrideTarget ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Pattern Badge */}
              {status?.pending_pattern && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid #6366f1',
                    color: '#818cf8',
                    fontSize: '12px',
                    fontWeight: 600,
                    width: 'fit-content',
                  }}
                  title="Розпізнаний патерн сторінки зі словника"
                >
                  🎯 Патерн: {status.pending_pattern}
                </div>
              )}

              {/* A7: Verification deadline timer */}
              {status?.pending_decision && (
                <div style={{ padding: '8px 12px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '6px' }}>
                  <div style={{ color: '#c084fc', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>
                    ⏱️ Дедлайн верифікації: {formatCountdown(verifCountdown)}
                  </div>
                  <div style={{ color: 'var(--color-text-tertiary)', fontSize: '11px', marginTop: '2px' }}>
                    Якщо не виконати коригування до кінця відліку, агент продовжить із власним рішенням.
                  </div>
                </div>
              )}

              {status?.pending_decision && (
                <>
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
                </>
              )}

              <div style={{ height: '1px', background: 'var(--color-background-muted)', margin: '4px 0' }} />

              {/* A5: Expanded Override Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  🛠️ Власне рішення людини (Override):
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={overrideAction}
                    onChange={(e) => setOverrideAction(e.target.value as 'click' | 'type' | 'scroll')}
                    style={{
                      background: 'var(--color-background-page)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      color: 'var(--color-text-primary)',
                      fontSize: '13px',
                      width: '130px',
                    }}
                  >
                    <option value="click">click (клік)</option>
                    <option value="type">type (ввід)</option>
                    <option value="scroll">scroll (прокрутка)</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Точна назва кнопки/пункту або селектор"
                    value={overrideTarget}
                    onChange={(e) => setOverrideTarget(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                {overrideAction === 'type' && (
                  <input
                    type="text"
                    placeholder="Текст для введення (override_value)"
                    value={overrideValue}
                    onChange={(e) => setOverrideValue(e.target.value)}
                    style={inputStyle}
                  />
                )}

                <textarea
                  placeholder="Пояснення правила (поведінка агента)"
                  value={overrideExplanation}
                  onChange={(e) => setOverrideExplanation(e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  style={secondaryButtonStyle}
                  onClick={handleOverrideStep}
                  disabled={busy === 'override_step' || (!overrideTarget.trim() && overrideAction !== 'scroll')}
                >
                  🎓 Навчити Агента (сигнал)
                </button>

                {/* Bridge to Rule Creation */}
                <button
                  type="button"
                  style={{
                    ...buttonStyle,
                    background: 'var(--color-accent)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onClick={() => setRuleComposerOpen(true)}
                >
                  📝 Оформити як правило
                </button>
              </div>

              {activeHost && (
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-accent)',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: 0,
                    }}
                    onClick={() => {
                      const query = new URLSearchParams({
                        host: activeHost,
                        persona: status?.profile || '*',
                        pattern: status?.pending_pattern || '',
                        q: overrideTarget || status?.pending_decision?.target_text || '',
                      });
                      navigate(`/rules?${query.toString()}`);
                    }}
                  >
                    Відкрити в базі правил (/rules) ↗
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-tertiary)', fontSize: '13px' }}>
              Немає кроку, що очікує верифікації.
            </div>
          )}
        </Card>
      </div>

      {/* A4: Panel "Правила, що діють на цей крок" */}
      {activeHost && (
        <Card padding={4}>
          <Heading level={2} style={sectionTitleStyle}>
            ⚡ Правила, що діють на цей крок (Хост: {activeHost})
          </Heading>
          {(!stepRules || stepRules.length === 0) ? (
            <div style={{ color: 'var(--color-text-tertiary)', fontSize: '13px' }}>
              Немає завантажених правил для {activeHost}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stepRules.map((r) => {
                const isMatchingPattern = Boolean(status?.pending_pattern && r.pattern === status.pending_pattern);
                return (
                  <div
                    key={r.id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: isMatchingPattern ? 'rgba(16, 185, 129, 0.12)' : 'var(--color-background-page)',
                      border: isMatchingPattern ? '2px solid #10b981' : '1px solid var(--color-border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                        <span style={{ fontFamily: 'monospace', color: 'var(--color-text-disabled)' }}>#{r.id}</span>
                        <span style={{ color: 'var(--color-accent)' }}>🎯 {r.pattern}</span>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            background: r.status === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                            color: r.status === 'active' ? '#10b981' : '#f59e0b',
                          }}
                        >
                          {r.status.toUpperCase()}
                        </span>
                        {isMatchingPattern && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: '#10b981',
                              color: '#ffffff',
                            }}
                          >
                            🎯 ДІЄ НА ЦЕЙ КРОК
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', marginTop: '4px' }}>
                        {r.behavior}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                      Персона: {r.persona} | Conf: {r.confidence}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

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

      {/* Bridge Modal: Rule Composer */}
      <Dialog
        isOpen={ruleComposerOpen}
        onOpenChange={(open) => setRuleComposerOpen(open)}
        variant="standard"
        width={620}
        maxHeight="85vh"
        purpose="info"
      >
        <Layout
          header={
            <DialogHeader
              title="📝 Оформити корекцію як правило"
              subtitle={activeHost ? `Хост: ${activeHost}` : undefined}
              onOpenChange={(open) => setRuleComposerOpen(open)}
            />
          }
          content={
            <LayoutContent>
              <RuleComposer
                initialHost={activeHost}
                initialPersona={status?.profile || '*'}
                initialPattern={status?.pending_pattern || ''}
                initialBehavior={
                  overrideExplanation ||
                  (overrideTarget ? `${overrideAction} "${overrideTarget}"` : '') ||
                  (status?.pending_decision?.target_text ? `Клікнути "${status.pending_decision.target_text}"` : '')
                }
                onCreated={() => {
                  setRuleComposerOpen(false);
                  refetchGate();
                }}
                onCancel={() => setRuleComposerOpen(false)}
              />
            </LayoutContent>
          }
        />
      </Dialog>
    </VStack>
  );
};
