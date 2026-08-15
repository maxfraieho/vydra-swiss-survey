import React, { useState, useEffect } from 'react';
import { useResource } from '../../api/hooks';
import { updateRule } from '../../api/rules';
import { Link } from 'react-router';
import { Card } from '@astryxdesign/core/Card';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { Slider } from '@astryxdesign/core/Slider';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { useToast } from '@astryxdesign/core/Toast';
import { RuleStatusPill } from '../../ui/primitives';

export interface LinkedTrace {
  run_id: string;
  host?: string;
  persona?: string;
  outcome?: string;
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
  effective?: boolean;
  linked_traces?: LinkedTrace[];
  note?: string;
}

interface RuleDetailProps {
  ruleId: number | null;
  onClose?: () => void;
  onUpdated?: () => void;
}

export const RuleDetail: React.FC<RuleDetailProps> = ({ ruleId, onClose, onUpdated }) => {
  const toast = useToast();
  const { data: rule, refetch } = useResource<RuleDetailData>(
    ruleId ? `/api/rules/${ruleId}` : null
  );

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [behavior, setBehavior] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0.7);
  const [status, setStatus] = useState<'active' | 'shadow' | 'retired'>('shadow');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (rule) {
      setBehavior(rule.behavior || '');
      setConfidence(rule.confidence ?? 0.7);
      setStatus(rule.status || 'shadow');
      setNote(rule.note || '');
      setIsEditing(false);
    }
  }, [rule]);

  const handleSave = async () => {
    if (!ruleId || !rule) return;
    if (!behavior.trim()) return;

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
      toast.show({ variant: 'success', title: `Правило #${ruleId} успішно оновлено!` });
      await refetch();
      setIsEditing(false);
      onUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Не вдалося оновити правило', description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  if (!ruleId) return null;

  return (
    <Dialog isOpen={Boolean(ruleId)} onClose={onClose || (() => {})}>
      <DialogHeader title={`Правило #${ruleId}`} />
      {rule && (
        <div className="flex-col gap-md">
          <div className="flex-between flex-wrap gap-sm">
            <div className="flex-row gap-sm items-center">
              <RuleStatusPill status={rule.status} />
              <Badge variant={rule.effective ? 'success' : 'neutral'} label={rule.effective ? 'Діє (Effective)' : 'Перекрито (Shadowed)'} />
            </div>
            <span className="text-xs text-secondary">
              Джерело: {rule.source}
            </span>
          </div>

          <div className="p-sm bg-subtle rounded-md border-default">
            <div className="text-xs text-tertiary">Патерн:</div>
            <div className="text-sm text-bold text-mono text-accent">
              {rule.pattern}
            </div>
            <div className="text-xs text-tertiary mt-xs">
              Хост: <strong>{rule.host}</strong> • Персона: <strong>{rule.persona}</strong>
            </div>
          </div>

          {!isEditing ? (
            <Card padding={3}>
              <div className="text-xs text-tertiary mb-xs">
                Поведінка (Behavior):
              </div>
              <div className="text-sm text-primary leading-normal whitespace-pre-wrap">
                {rule.behavior}
              </div>
              <div className="text-xs text-secondary mt-sm">
                Впевненість: {Math.round((rule.confidence || 0) * 100)}%
              </div>
              {rule.note && (
                <div className="text-xs text-tertiary mt-xs">
                  Примітка: {rule.note}
                </div>
              )}
              <div className="flex-row justify-end mt-sm">
                <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                  ✎ Редагувати
                </Button>
              </div>
            </Card>
          ) : (
            <Card padding={3}>
              <div className="flex-col gap-sm">
                <TextArea
                  label="Поведінка"
                  value={behavior}
                  onChange={(val) => setBehavior(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
                />
                <Selector
                  label="Статус"
                  value={status}
                  onChange={(v) => setStatus(v as 'active' | 'shadow' | 'retired')}
                  options={[
                    { value: 'active', label: 'Діє (Active)' },
                    { value: 'shadow', label: 'На випробуванні (Shadow)' },
                    { value: 'retired', label: 'Застаріле (Retired)' },
                  ]}
                />
                <Slider
                  label={`Впевненість: ${Math.round(confidence * 100)}%`}
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={confidence}
                  onChange={(v) => setConfidence(v)}
                />
                <TextArea
                  label="Примітка"
                  value={note}
                  onChange={(val) => setNote(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
                />
                <div className="flex-row justify-end gap-sm">
                  <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                    Скасувати
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSave} disabled={submitting}>
                    {submitting ? 'Збереження...' : 'Зберегти'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {rule.linked_traces && rule.linked_traces.length > 0 && (
            <div className="border-top pt-xs">
              <div className="text-xs text-bold text-secondary mb-xs">
                Пов'язані прогони ({rule.linked_traces.length})
              </div>
              <div className="flex-col gap-xs">
                {rule.linked_traces.slice(0, 4).map((t) => (
                  <Link
                    key={t.run_id}
                    to={`/traces/${t.run_id}`}
                    className="text-xs text-accent no-underline"
                  >
                    Прогін #{t.run_id} ({t.outcome || 'outcome'}) →
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
};
