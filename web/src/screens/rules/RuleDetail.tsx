import React from 'react';
import { useResource } from '../../api/hooks';
import { Link } from 'react-router';
import { Markdown } from '../../ui/Markdown';

export interface LinkedTrace {
  run_id: string;
  host?: string;
  persona?: string;
  outcome?: string;
  created_at?: string;
}

export interface RuleDetailData {
  id: number;
  host: string;
  persona: string;
  pattern: string;
  behavior: string;
  source: string;
  status: 'active' | 'shadow' | 'retired';
  confidence: number;
  evidence: any;
  created_at?: string;
  effective?: boolean;
  shadowed_by?: number | null;
  linked_traces?: LinkedTrace[];
}

interface RuleDetailProps {
  ruleId: number | null;
  onClose?: () => void;
}

export const RuleDetail: React.FC<RuleDetailProps> = ({ ruleId, onClose }) => {
  const { data: rule, loading, error } = useResource<RuleDetailData>(
    ruleId ? `/api/rules/${ruleId}` : null
  );

  if (!ruleId) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
        Оберіть правило зі списку для перегляду деталей
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
        Завантаження деталей правила #{ruleId}...
      </div>
    );
  }

  if (error || !rule) {
    return (
      <div style={{ padding: '24px', color: '#f87171', fontSize: '13px' }}>
        Помилка завантаження правила #{ruleId}: {error?.message || 'Не знайдено'}
      </div>
    );
  }

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', spaceY: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #1e293b', pb: '12px' }}>
        <div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
            Правило #{rule.id}
          </span>
          <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
            {rule.pattern}
          </h3>
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
            textTransform: 'uppercase',
            background: rule.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : rule.status === 'shadow' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(107, 114, 128, 0.15)',
            color: rule.status === 'active' ? '#34d399' : rule.status === 'shadow' ? '#fbbf24' : '#9ca3af',
            border: `1px solid ${rule.status === 'active' ? '#059669' : rule.status === 'shadow' ? '#d97706' : '#4b5563'}`,
          }}
        >
          {rule.status}
        </span>

        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '4px',
            background: rule.effective ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: rule.effective ? '#60a5fa' : '#f87171',
            border: `1px solid ${rule.effective ? '#2563eb' : '#dc2626'}`,
          }}
        >
          {rule.effective ? '✅ Ефективне' : `⚠️ Затінене #${rule.shadowed_by}`}
        </span>

        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: '#1e293b', color: '#cbd5e1' }}>
          Хост: <strong>{rule.host}</strong>
        </span>

        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: '#1e293b', color: '#cbd5e1' }}>
          Персона: <strong>{rule.persona}</strong>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '12px' }}>
        <div style={{ background: '#020617', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b' }}>
          <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Поведінка (Behavior)</span>
          <Markdown source={rule.behavior} variant="compact" />
        </div>
        <div style={{ background: '#020617', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b' }}>
          <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Джерело / Confidence</span>
          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{rule.source} ({rule.confidence})</span>
        </div>
      </div>

      {rule.evidence && (
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
            Докази (Evidence)
          </span>
          <pre
            style={{
              background: '#020617',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '11px',
              color: '#cbd5e1',
              overflowX: 'auto',
              maxHeight: '180px',
              margin: 0,
            }}
          >
            {JSON.stringify(rule.evidence, null, 2)}
          </pre>
        </div>
      )}

      {rule.linked_traces && rule.linked_traces.length > 0 && (
        <div>
          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
            Пов'язані прогони (Traces)
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {rule.linked_traces.map((t) => (
              <Link
                key={t.run_id}
                to={`/traces/${encodeURIComponent(t.run_id)}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  background: '#020617',
                  border: '1px solid #1e293b',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  color: '#60a5fa',
                  textDecoration: 'none',
                  fontSize: '12px',
                }}
              >
                <span>{t.run_id}</span>
                <span style={{ color: '#64748b' }}>{t.outcome || 'trace'}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
