import React, { useState } from 'react';
import { createRule } from '../../api/rules';
import { useResource } from '../../api/hooks';
import { HostRow, PersonaRow } from '../../api/settings';
import { BehaviorEditor } from './BehaviorEditor';
import { Selector } from '@astryxdesign/core/Selector';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Slider } from '@astryxdesign/core/Slider';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { useToast } from '@astryxdesign/core/Toast';

export interface RuleComposerProps {
  isOpen?: boolean;
  onClose?: () => void;
  onCreated: () => void;
  onCancel?: () => void;
  initialHost?: string;
  initialPersona?: string;
  initialPattern?: string;
  initialBehavior?: string;
}

export const RuleComposer: React.FC<RuleComposerProps> = ({
  isOpen = true,
  onClose,
  onCreated,
  onCancel,
  initialHost = '',
  initialPersona = '*',
  initialPattern = '',
  initialBehavior = '',
}) => {
  const toast = useToast();
  const { data: hostsData } = useResource<HostRow[]>('/api/settings/hosts');
  const { data: personasData } = useResource<PersonaRow[]>('/api/settings/personas');

  const [host, setHost] = useState<string>(initialHost);
  const [persona, setPersona] = useState<string>(initialPersona);
  const [pattern, setPattern] = useState<string>(initialPattern);
  const [behavior, setBehavior] = useState<string>(initialBehavior);
  const [confidence, setConfidence] = useState<number>(0.7);
  const [status, setStatus] = useState<'active' | 'shadow' | 'retired'>('shadow');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedHost = host.trim();
    const trimmedPattern = pattern.trim();
    const trimmedBehavior = behavior.trim();

    if (!trimmedHost || !trimmedPattern || !trimmedBehavior) return;

    setSubmitting(true);
    try {
      await createRule({
        host: trimmedHost,
        persona: persona.trim() || '*',
        pattern: trimmedPattern,
        behavior: trimmedBehavior,
        confidence,
        status,
        note: note.trim() || undefined,
      });
      toast.show({ variant: 'success', title: 'Правило успішно створено!' });
      onCreated();
      onClose?.();
      onCancel?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Не вдалося створити правило', description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const hostOptions = [
    { value: '', label: 'Виберіть або введіть хост...' },
    { value: '*', label: '* (Глобальне для всіх хостів)' },
    ...(hostsData || []).map((h) => ({ value: h.hostname, label: h.hostname })),
  ];

  const personaOptions = [
    { value: '*', label: '* (Усі персони)' },
    ...(personasData || []).map((p) => ({ value: p.key, label: `${p.label} (${p.key})` })),
  ];

  return (
    <Dialog isOpen={isOpen} onClose={onClose || onCancel || (() => {})}>
      <DialogHeader title="Створити нове правило" />
      <form onSubmit={handleSubmit} className="flex-col gap-md">
        <Selector
          label="Цільовий хост"
          value={host}
          onChange={(v) => setHost(v)}
          options={hostOptions}
        />

        <Selector
          label="Персона"
          value={persona}
          onChange={(v) => setPersona(v)}
          options={personaOptions}
        />

        <BehaviorEditor
          behavior={behavior}
          onBehaviorChange={setBehavior}
          pattern={pattern}
          onPatternChange={setPattern}
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
          placeholder="Обґрунтування або джерело правила"
        />

        <div className="flex-row justify-end gap-sm mt-sm">
          <Button variant="secondary" onClick={onClose || onCancel || (() => {})}>
            Скасувати
          </Button>
          <Button variant="primary" type="submit" disabled={submitting || !host || !pattern || !behavior}>
            {submitting ? 'Збереження...' : 'Створити правило'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
