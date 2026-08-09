import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { Markdown } from '../../ui/Markdown';
import { parseDrakonPseudocode, ParsedRule, ParseResult } from './drakonPseudocode';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';

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


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Two-tab switcher */}
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <Button
            type="button"
            variant={activeTab === 'text' ? 'primary' : 'secondary'}
            label="Текст"
            onClick={() => setActiveTab('text')}
          />
          <Button
            type="button"
            variant={activeTab === 'pseudocode' ? 'primary' : 'secondary'}
            label="Псевдокод"
            onClick={() => setActiveTab('pseudocode')}
          />
        </div>

        {activeTab === 'text' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <TextArea
              label="Інструкція поведінки (Behavior)"
              value={behavior}
              onChange={onBehaviorChange}
              placeholder="Введіть інструкцію поведінки агента (українською мовою)..."
              rows={6}
              maxLength={2000}
            />
          </div>
        )}

        {activeTab === 'pseudocode' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <TextArea
              label="DRAKON псевдокод або JSON export"
              value={scratchText}
              onChange={setScratchText}
              placeholder={'# назва\nIF умова\nTHEN\nдія\nEND'}
              rows={6}
            />

            <div>
              <Button type="button" variant="secondary" label="Розпізнати" onClick={handleParse} />
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
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        label="Застосувати"
                        onClick={() => handleApplyRule(rule)}
                      />
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
        <Card
          padding={4}
          style={{ minHeight: '48px' }}
        >
          {behavior && behavior.trim() !== '' ? (
            <Markdown source={behavior} />
          ) : (
            <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>
              Попередній перегляд з'явиться тут при введенні тексту...
            </span>
          )}
        </Card>
      </div>

      {/* 3. Pattern select */}
      <Selector
        label="Патерн (Pattern)"
        isLoading={vocabLoading}
        placeholder="-- Оберіть патерн --"
        value={pattern || undefined}
        onChange={(v) => onPatternChange(v || '')}
        options={
          pattern && !knownPatterns.includes(pattern)
            ? [...knownPatterns, { value: pattern, label: `${pattern} (застарілий)` }]
            : knownPatterns
        }
      />
    </div>
  );
};
