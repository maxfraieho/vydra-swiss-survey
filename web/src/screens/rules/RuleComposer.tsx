import React, { useState } from 'react';
import { createRule } from '../../api/rules';
import { RuleDetailData } from './RuleDetail';
import { BehaviorEditor } from './BehaviorEditor';

export interface RuleComposerProps {
  onCreated: (rule: RuleDetailData) => void;
  onCancel: () => void;
}

export const RuleComposer: React.FC<RuleComposerProps> = ({ onCreated, onCancel }) => {
  const [host, setHost] = useState<string>('');
  const [persona, setPersona] = useState<string>('*');
  const [pattern, setPattern] = useState<string>('');
  const [behavior, setBehavior] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0.7);
  const [status, setStatus] = useState<'active' | 'shadow' | 'retired'>('shadow');
  const [note, setNote] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState<boolean>(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAttemptedSubmit(true);
    setSubmitError(null);

    const trimmedHost = host.trim();
    const trimmedPattern = pattern.trim();
    const trimmedBehavior = behavior.trim();

    const missingFields: string[] = [];
    if (!trimmedHost) missingFields.push('Хост');
    if (!trimmedPattern) missingFields.push('Патерн');
    if (!trimmedBehavior) missingFields.push('Поведінка');

    if (missingFields.length > 0) {
      setSubmitError(`Будь ласка, заповніть обов'язкові поля: ${missingFields.join(', ')}`);
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
      onCreated(result);
    } catch (err: any) {
      setSubmitError(err?.message || 'Не вдалося створити правило');
    } finally {
      setSubmitting(false);
    }
  };

  const isHostEmpty = host.trim() === '';
  const isSubmitDisabled = submitting || isHostEmpty;

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '20px',
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
          borderBottom: '1px solid #1e293b',
        }}
      >
        <div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
            Створення
          </span>
          <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
            Нове правило
          </h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Error display */}
      {submitError && (
        <div
          style={{
            padding: '10px 12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #dc2626',
            borderRadius: '8px',
            color: '#f87171',
            fontSize: '13px',
          }}
        >
          ⚠️ {submitError}
        </div>
      )}

      {/* 2-col Grid: Host & Persona */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
            Хост (Host) <span style={{ color: '#f87171' }}>*</span>
          </label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="e.g. example.com"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#020617',
              border: attemptedSubmit && !host.trim() ? '1px solid #f87171' : '1px solid #334155',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#f8fafc',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          {attemptedSubmit && !host.trim() && (
            <span style={{ fontSize: '11px', color: '#f87171' }}>Обов'язкове поле</span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
            Персона (Persona)
          </label>
          <input
            type="text"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="*"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#020617',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#f8fafc',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>
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
          <div style={{ fontSize: '11px', color: '#f87171', marginTop: '6px' }}>
            {!pattern.trim() && !behavior.trim()
              ? "Оберіть патерн та введіть інструкцію поведінки"
              : !pattern.trim()
              ? "Оберіть патерн"
              : "Введіть інструкцію поведінки"}
          </div>
        )}
      </div>

      {/* 2-col Grid: Confidence & Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
              Confidence
            </label>
            <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>
              {confidence.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={confidence}
            onChange={(e) => setConfidence(parseFloat(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#38bdf8',
              cursor: 'pointer',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
            Статус (Status)
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'shadow' | 'retired')}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#020617',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#f8fafc',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="shadow">Shadow</option>
            <option value="active">Active</option>
            <option value="retired">Retired</option>
          </select>
        </div>
      </div>

      {/* Note (optional textarea) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
          Примітка (Note) <span style={{ fontWeight: 400, color: '#64748b' }}>(необов'язково)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Короткий коментар або нотатка..."
          rows={2}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: '#020617',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#f8fafc',
            fontSize: '13px',
            fontFamily: 'inherit',
            resize: 'vertical',
            outline: 'none',
          }}
        />
      </div>

      {/* Submit row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            border: '1px solid #334155',
            background: 'transparent',
            color: '#94a3b8',
            transition: 'all 0.15s ease',
          }}
        >
          Скасувати
        </button>
        <button
          type="submit"
          disabled={isSubmitDisabled}
          style={{
            padding: '8px 18px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
            opacity: isSubmitDisabled ? 0.5 : 1,
            border: '1px solid #38bdf8',
            background: '#1e293b',
            color: '#38bdf8',
            transition: 'all 0.15s ease',
          }}
        >
          {submitting ? 'Створення...' : 'Створити'}
        </button>
      </div>
    </form>
  );
};
