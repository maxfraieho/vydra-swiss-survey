import React from 'react';
import { useResource } from '../../api/hooks';
import { Link } from 'react-router';
import { Markdown } from '@astryxdesign/core/Markdown';
import { useIsNarrow } from '../../shell/useIsNarrow';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';

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
  const isNarrow = useIsNarrow();
  const { data: rule, loading, error } = useResource<RuleDetailData>(
    ruleId ? `/api/rules/${ruleId}` : null
  );

  if (!ruleId) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '13px' }}>
        Оберіть правило зі списку для перегляду деталей
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: '13px' }}>
        Завантаження деталей правила #{ruleId}...
      </div>
    );
  }

  if (error || !rule) {
    return (
      <div style={{ padding: '24px', color: 'var(--color-text-red)', fontSize: '13px' }}>
        Помилка завантаження правила #{ruleId}: {error?.message || 'Не знайдено'}
      </div>
    );
  }

  return (
    <Card padding={5}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--color-border-emphasized)', paddingBottom: '12px' }}>
        <div>
          <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
            Правило #{rule.id}
          </span>
          <Heading level={3} style={{ marginTop: '4px', fontSize: '18px' }}>
            {rule.pattern}
          </Heading>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-disabled)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              minHeight: '44px',
              minWidth: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            background: rule.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : rule.status === 'shadow' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(107, 114, 128, 0.15)',
            color: rule.status === 'active' ? 'var(--color-text-green)' : rule.status === 'shadow' ? 'var(--color-text-yellow)' : '#9ca3af',
            border: `1px solid ${rule.status === 'active' ? '#059669' : rule.status === 'shadow' ? '#d97706' : '#4b5563'}`,
          }}
        >
          {rule.status}
        </span>

        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '4px',
            background: rule.effective ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: rule.effective ? 'var(--color-text-blue)' : 'var(--color-text-red)',
            border: `1px solid ${rule.effective ? '#2563eb' : 'var(--color-border-red)'}`,
          }}
        >
          {rule.effective ? '✅ Ефективне' : `⚠️ Затінене #${rule.shadowed_by}`}
        </span>

        <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', background: 'var(--color-background-muted)', color: 'var(--color-text-secondary)' }}>
          Хост: <strong>{rule.host}</strong>
        </span>

        <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', background: 'var(--color-background-muted)', color: 'var(--color-text-secondary)' }}>
          Персона: <strong>{rule.persona}</strong>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '12px' }}>
        <Card variant="muted" padding={3}>
          <span style={{ color: 'var(--color-text-tertiary)', display: 'block', fontSize: '12px' }}>Поведінка (Behavior)</span>
          <Markdown density="compact" headingLevelStart={4}>{rule.behavior}</Markdown>
        </Card>
        <Card variant="muted" padding={3}>
          <span style={{ color: 'var(--color-text-tertiary)', display: 'block', fontSize: '12px' }}>Джерело / Confidence</span>
          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{rule.source} ({rule.confidence})</span>
        </Card>
      </div>

      {rule.evidence && (
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-disabled)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
            Докази (Evidence)
          </span>
          <pre
            style={{
              background: 'var(--color-background-page)',
              border: '1px solid var(--color-border-emphasized)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
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
          <span style={{ fontSize: '12px', color: 'var(--color-text-disabled)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
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
                  background: 'var(--color-background-page)',
                  border: '1px solid var(--color-border-emphasized)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  color: 'var(--color-text-blue)',
                  textDecoration: 'none',
                  fontSize: '12px',
                }}
              >
                <span>{t.run_id}</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>{t.outcome || 'trace'}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
