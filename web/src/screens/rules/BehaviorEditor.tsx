import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { parseDrakonPseudocode, ParsedRule, ParseResult } from './drakonPseudocode';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
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

  const { data: vocabData } = useResource<{ topic_keywords: string[] }>(
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
    <div className="flex-col gap-md">
      <div className="flex-row gap-xs mb-xs">
        <Button
          type="button"
          size="sm"
          variant={activeTab === 'text' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('text')}
        >
          Текст
        </Button>
        <Button
          type="button"
          size="sm"
          variant={activeTab === 'pseudocode' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('pseudocode')}
        >
          Псевдокод
        </Button>
      </div>

      {activeTab === 'text' && (
        <TextArea
          label="Інструкція поведінки (Behavior)"
          value={behavior}
          onChange={(e) => onBehaviorChange(e.target.value)}
          placeholder="Введіть інструкцію поведінки агента (українською мовою)..."
          rows={5}
        />
      )}

      {activeTab === 'pseudocode' && (
        <div className="flex-col gap-sm">
          <TextArea
            label="DRAKON псевдокод або JSON export"
            value={scratchText}
            onChange={(e) => setScratchText(e.target.value)}
            placeholder={'# назва\nIF умова\nTHEN\nдія\nEND'}
            rows={5}
          />

          <div className="flex-row justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={handleParse}>
              Розпізнати
            </Button>
          </div>

          {parseResult && parseResult.inputKind === 'json' && (
            <div className="p-sm bg-subtle rounded-md border-default text-xs text-yellow">
              ⚠️ DRAKON JSON імпорт поки не підтримується — вставте псевдокод з "Export Pseudocode".
            </div>
          )}

          {parseResult && parseResult.inputKind === 'pseudocode' && (
            <div className="flex-col gap-sm">
              {parseResult.rules.map((rule, idx) => (
                <Card key={idx} padding={3}>
                  <div className="flex-between flex-wrap gap-xs mb-xs">
                    <span className="text-sm text-bold text-primary">{rule.name || '(без назви)'}</span>
                    <div className="flex-row items-center gap-xs">
                      <span className="text-xs text-accent text-mono">{rule.suggestedPattern || '(не вказано)'}</span>
                      {!rule.patternIsKnown && (
                        <Badge variant="warning" label="невідомий патерн" />
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-secondary mb-sm">{rule.suggestedBehavior}</div>

                  <div className="flex-row justify-end">
                    <Button type="button" variant="primary" size="sm" onClick={() => handleApplyRule(rule)}>
                      Застосувати це правило
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
