import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { Markdown } from '../../ui/Markdown';
import { parseDrakonPseudocode, ParsedRule, ParseResult } from './drakonPseudocode';

export interface BehaviorEditorProps {
  behavior: string;
  onBehaviorChange: (v: string) => void;
  pattern: string;
  onPatternChange: (v: string) => void;
}

export const BehaviorEditor: React.FC<BehaviorEditorProps> = ({
  behavior,
  onBehaviorChange,
  pattern,
  onPatternChange,
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'pseudocode'>('text');
  const [scratchText, setScratchText] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const { data: vocabData, loading: vocabLoading } = useResource<{ topic_keywords: string[] }>(
    '/api/rules/vocabulary'
  );

  const knownPatterns = vocabData?.topic_keywords ?? [];

  const handleParse = () => {
    const res = parseDrakonPseudocode(scratchText, knownPatterns);
    setParseResult(res);
  };

  const handleApplyRule = (rule: ParsedRule) => {
    onBehaviorChange(rule.suggestedBehavior);
    onPatternChange(rule.suggestedPattern);
    setActiveTab('text');
  };

  const charCount = behavior ? behavior.length : 0;
  let counterColor = '#94a3b8';
  if (charCount >= 2000) {
    counterColor = '#f87171';
  } else if (charCount > 1800) {
    counterColor = '#fbbf24';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Two-tab switcher */}
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'text' ? '1px solid #38bdf8' : '1px solid #1e293b',
              background: activeTab === 'text' ? '#1e293b' : '#020617',
              color: activeTab === 'text' ? '#f8fafc' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            Текст
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pseudocode')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'pseudocode' ? '1px solid #38bdf8' : '1px solid #1e293b',
              background: activeTab === 'pseudocode' ? '#1e293b' : '#020617',
              color: activeTab === 'pseudocode' ? '#f8fafc' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            Псевдокод
          </button>
        </div>

        {activeTab === 'text' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
              Інструкція поведінки (Behavior)
            </label>
            <textarea
              value={behavior}
              onChange={(e) => onBehaviorChange(e.target.value)}
              placeholder="Введіть інструкцію поведінки агента (українською мовою)..."
              rows={6}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#020617',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '11px', color: counterColor }}>
              {charCount} / 2000
            </div>
          </div>
        )}

        {activeTab === 'pseudocode' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                DRAKON псевдокод або JSON export
              </label>
              <textarea
                value={scratchText}
                onChange={(e) => setScratchText(e.target.value)}
                placeholder={'# назва\nIF умова\nTHEN\nдія\nEND'}
                rows={6}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#020617',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <button
                type="button"
                onClick={handleParse}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid #38bdf8',
                  background: '#1e293b',
                  color: '#38bdf8',
                }}
              >
                Розпізнати
              </button>
            </div>

            {parseResult && parseResult.inputKind === 'json' && (
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid #d97706',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#fbbf24',
                  fontSize: '13px',
                }}
              >
                ⚠️ DRAKON JSON імпорт поки не підтримується — вставте псевдокод з "Export Pseudocode".
              </div>
            )}

            {parseResult && parseResult.inputKind === 'pseudocode' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {parseResult.rules.map((rule, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#020617',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '14px' }}>
                        {rule.name || '(без назви)'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#38bdf8', fontFamily: 'monospace' }}>
                          {rule.suggestedPattern || '(не вказано)'}
                        </span>
                        {!rule.patternIsKnown && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#fbbf24',
                              border: '1px solid #d97706',
                            }}
                          >
                            невідомий патерн
                          </span>
                        )}
                      </div>
                    </div>

                    {rule.warnings.length > 0 && (
                      <div style={{ fontSize: '12px', color: '#fbbf24', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {rule.warnings.map((w, wIdx) => (
                          <div key={wIdx}>⚠️ {w}</div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleApplyRule(rule)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: '1px solid #059669',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                        }}
                      >
                        Застосувати
                      </button>
                    </div>
                  </div>
                ))}

                {parseResult.globalUnparsed.length > 0 && (
                  <div
                    style={{
                      background: '#020617',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '12px',
                      color: '#cbd5e1',
                    }}
                  >
                    <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: '6px' }}>
                      Нерозпізнані рядки:
                    </div>
                    {parseResult.globalUnparsed.map((u, uIdx) => (
                      <div key={uIdx} style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>
                        L{u.line}: "{u.text}" — {u.reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Live preview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
          Попередній перегляд
        </label>
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '12px 16px',
            minHeight: '48px',
          }}
        >
          {behavior && behavior.trim() !== '' ? (
            <Markdown source={behavior} />
          ) : (
            <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>
              Попередній перегляд з'явиться тут при введенні тексту...
            </span>
          )}
        </div>
      </div>

      {/* 3. Pattern select */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
          Патерн (Pattern)
        </label>
        <select
          value={pattern}
          onChange={(e) => onPatternChange(e.target.value)}
          disabled={vocabLoading}
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
            cursor: vocabLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {vocabLoading ? (
            <option value="">Завантаження словника...</option>
          ) : (
            <>
              <option value="">-- Оберіть патерн --</option>
              {knownPatterns.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              {pattern && !knownPatterns.includes(pattern) && (
                <option key={pattern} value={pattern}>
                  {pattern} (застарілий)
                </option>
              )}
            </>
          )}
        </select>
      </div>
    </div>
  );
};
