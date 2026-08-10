import React, { useState, useEffect } from 'react';
import { useResource } from '../../api/hooks';
import { updateRule } from '../../api/rules';
import { Link } from 'react-router';
import { Markdown } from '@astryxdesign/core/Markdown';
import { useIsNarrow } from '../../shell/useIsNarrow';
import { Card } from '@astryxdesign/core/Card';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { Slider } from '@astryxdesign/core/Slider';
import { Button } from '@astryxdesign/core/Button';
import { useToast } from '@astryxdesign/core/Toast';

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
  note?: string;
}

interface RuleDetailProps {
  ruleId: number | null;
  onClose?: () => void;
  onUpdated?: () => void;
}

export const RuleDetail: React.FC<RuleDetailProps> = ({ ruleId, onClose, onUpdated }) => {
  const isNarrow = useIsNarrow();
  const toast = useToast();
  const { data: rule, loading, error, refetch } = useResource<RuleDetailData>(
    ruleId ? `/api/rules/${ruleId}` : null
  );

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [behavior, setBehavior] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0.7);
  const [status, setStatus] = useState<'active' | 'shadow' | 'retired'>('shadow');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Sync edit form state when rule data is loaded
  useEffect(() => {
    if (rule) {
      setBehavior(rule.behavior || '');
      setConfidence(rule.confidence ?? 0.7);
      setStatus(rule.status || 'shadow');
      setNote(rule.note || '');
      setIsEditing(false);
    }
  }, [rule]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ruleId || !rule) return;

    if (!behavior.trim()) {
      toast({ body: 'Поведінка не може бути порожньою', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await updateRule(ruleId, {
        host: rule.host,
        persona: rule.persona,
        pattern: rule.pattern,
        behavior: behavior.trim(),
        confidence,
        status,
        note: note.trim() || undefined,
      });
      toast({ body: `Правило #${ruleId} успішно оновлено!` });
      await refetch();
      setIsEditing(false);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast({ body: err?.message || 'Не вдалося оновити правило', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={ruleId !== null}
      onOpenChange={(open) => {
        if (!open && onClose) {
          setIsEditing(false);
          onClose();
        }
      }}
      variant="standard"
      width={600}
      maxHeight="85vh"
      purpose="info"
    >
      <Layout
        header={
          <DialogHeader
            title={rule ? `Правило #${rule.id}` : ruleId ? `Правило #${ruleId}` : 'Деталі правила'}
            subtitle={rule?.pattern}
            onOpenChange={(open) => {
              if (!open && onClose) {
                setIsEditing(false);
                onClose();
              }
            }}
          />
        }
        content={
          <LayoutContent>
            {loading && (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: '13px' }}>
                Завантаження деталей правила #{ruleId}...
              </div>
            )}

            {error && (
              <div style={{ padding: '24px', color: 'var(--color-text-red)', fontSize: '13px' }}>
                Помилка завантаження правила #{ruleId}: {error.message}
              </div>
            )}

            {!loading && !error && rule && (
              <div>
                {/* Header Action Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
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

                  {!isEditing && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      label="✏️ Редагувати"
                      onClick={() => setIsEditing(true)}
                    />
                  )}
                </div>

                {/* EDIT MODE FORM */}
                {isEditing ? (
                  <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
                    <div style={{ background: 'var(--color-background-muted)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-accent)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-accent)', marginBottom: '8px' }}>
                        ✏️ Редагування правила #{rule.id} ({rule.pattern})
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <TextArea
                          label="Інструкція поведінки (Behavior)"
                          value={behavior}
                          onChange={setBehavior}
                          rows={4}
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '12px' }}>
                          <Slider
                            label="Confidence"
                            min={0}
                            max={1}
                            step={0.05}
                            value={confidence}
                            onChange={setConfidence}
                            valueDisplay="text"
                            formatValue={(v) => v.toFixed(2)}
                          />

                          <Selector
                            label="Статус (Status)"
                            value={status}
                            onChange={(v) => setStatus((v as 'active' | 'shadow' | 'retired') || 'shadow')}
                            options={[
                              { value: 'shadow', label: 'Shadow' },
                              { value: 'active', label: 'Active' },
                              { value: 'retired', label: 'Retired' },
                            ]}
                          />
                        </div>

                        <TextArea
                          label="Примітка аудиту (Note)"
                          isOptional
                          value={note}
                          onChange={setNote}
                          placeholder="Причина внесення змін..."
                          rows={2}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                          <Button
                            type="button"
                            variant="secondary"
                            label="Скасувати"
                            onClick={() => {
                              setBehavior(rule.behavior || '');
                              setConfidence(rule.confidence ?? 0.7);
                              setStatus(rule.status || 'shadow');
                              setNote(rule.note || '');
                              setIsEditing(false);
                            }}
                          />
                          <Button
                            type="submit"
                            variant="primary"
                            label={submitting ? 'Збереження...' : 'Зберегти зміни'}
                            isDisabled={submitting}
                          />
                        </div>
                      </div>
                    </div>
                  </form>
                ) : (
                  /* VIEW MODE */
                  <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '12px' }}>
                    <Card variant="muted" padding={3}>
                      <span style={{ color: 'var(--color-text-tertiary)', display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                        Поведінка (Behavior)
                      </span>
                      <Markdown density="compact" headingLevelStart={4}>{rule.behavior}</Markdown>
                    </Card>
                    <Card variant="muted" padding={3}>
                      <span style={{ color: 'var(--color-text-tertiary)', display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                        Джерело / Confidence
                      </span>
                      <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{rule.source} ({rule.confidence})</span>
                      {rule.note && (
                        <div style={{ marginTop: '8px', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                          <strong>Примітка:</strong> {rule.note}
                        </div>
                      )}
                    </Card>
                  </div>
                )}

                {/* Evidence section */}
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

                {/* Linked traces section */}
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
              </div>
            )}
          </LayoutContent>
        }
      />
    </Dialog>
  );
};
