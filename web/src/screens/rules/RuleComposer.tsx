import React, { useState } from 'react';
import { createRule } from '../../api/rules';
import { useResource } from '../../api/hooks';
import { HostRow, PersonaRow } from '../../api/settings';
import { RuleDetailData } from './RuleDetail';
import { BehaviorEditor } from './BehaviorEditor';
import { useIsNarrow } from '../../shell/useIsNarrow';
import { Selector } from '@astryxdesign/core/Selector';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Slider } from '@astryxdesign/core/Slider';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { useToast } from '@astryxdesign/core/Toast';

export interface RuleComposerProps {
  onCreated: (rule: RuleDetailData) => void;
  onCancel: () => void;
}

export const RuleComposer: React.FC<RuleComposerProps> = ({ onCreated, onCancel }) => {
  const isNarrow = useIsNarrow();
  const toast = useToast();
  const { data: hostsData, loading: hostsLoading } = useResource<HostRow[]>('/api/settings/hosts');
  const { data: personasData, loading: personasLoading } = useResource<PersonaRow[]>('/api/settings/personas');

  const [host, setHost] = useState<string>('');
  const [persona, setPersona] = useState<string>('*');
  const [pattern, setPattern] = useState<string>('');
  const [behavior, setBehavior] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0.7);
  const [status, setStatus] = useState<'active' | 'shadow' | 'retired'>('shadow');
  const [note, setNote] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState<boolean>(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAttemptedSubmit(true);

    const trimmedHost = host.trim();
    const trimmedPattern = pattern.trim();
    const trimmedBehavior = behavior.trim();

    const missingFields: string[] = [];
    if (!trimmedHost) missingFields.push('Хост');
    if (!trimmedPattern) missingFields.push('Патерн');
    if (!trimmedBehavior) missingFields.push('Поведінка');

    if (missingFields.length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await createRule({
        host: trimmedHost,
        persona: persona.trim() || '*',
        pattern: trimmedPattern,
        behavior: trimmedBehavior,
        confidence,
        status,
        note: note.trim() || undefined,
      });
      toast({ body: 'Збережено' });
      onCreated(result);
    } catch (err: any) {
      toast({ body: err?.message || 'Не вдалося створити правило', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const isHostEmpty = host.trim() === '';
  const isSubmitDisabled = submitting || isHostEmpty;

  return (
    <Card padding={5}>
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--color-border-emphasized)',
        }}
      >
        <div>
          <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
            Створення
          </span>
          <Heading level={3} style={{ marginTop: '4px' }}>
            Нове правило
          </Heading>
        </div>
        <button
          type="button"
          onClick={onCancel}
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
      </div>

      {/* Error display */}

      {/* 2-col Grid: Host & Persona */}
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '12px' }}>
        <Selector
          label="Хост (Host)"
          isRequired
          isLoading={hostsLoading}
          placeholder="-- Оберіть хост --"
          value={host || undefined}
          onChange={(v) => setHost(v || '')}
          status={attemptedSubmit && !host.trim() ? { type: 'error', message: "Обов'язкове поле" } : undefined}
          options={(hostsData ?? []).map((h) => ({ value: h.hostname, label: h.label || h.hostname }))}
        />

        <Selector
          label="Персона (Persona)"
          isLoading={personasLoading}
          value={persona}
          onChange={(v) => setPersona(v || '*')}
          options={[
            { value: '*', label: '* (усі персони)' },
            ...(personasData ?? []).map((p) => ({ value: p.key, label: p.label ? `${p.key} (${p.label})` : p.key })),
          ]}
        />
      </div>

      {/* BehaviorEditor component */}
      <div>
        <BehaviorEditor
          behavior={behavior}
          onBehaviorChange={setBehavior}
          pattern={pattern}
          onPatternChange={setPattern}
        />
        {attemptedSubmit && (!pattern.trim() || !behavior.trim()) && (
          <div style={{ fontSize: '12px', color: 'var(--color-text-red)', marginTop: '6px' }}>
            {!pattern.trim() && !behavior.trim()
              ? "Оберіть патерн та введіть інструкцію поведінки"
              : !pattern.trim()
              ? "Оберіть патерн"
              : "Введіть інструкцію поведінки"}
          </div>
        )}
      </div>

      {/* 2-col Grid: Confidence & Status */}
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

      {/* Note (optional textarea) */}
      <TextArea
        label="Примітка (Note)"
        isOptional
        value={note}
        onChange={setNote}
        placeholder="Короткий коментар або нотатка..."
        rows={2}
      />

      {/* Submit row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
        <Button type="button" variant="secondary" label="Скасувати" onClick={onCancel} />
        <Button
          type="submit"
          variant="primary"
          label={submitting ? 'Створення...' : 'Створити'}
          isDisabled={isSubmitDisabled}
        />
      </div>
    </form>
    </Card>
  );
};
