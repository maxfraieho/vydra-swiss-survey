import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { PageHeader, EmptyState, RuleStatusPill } from '../../ui/primitives';
import type { RuleRow } from './RulesTable';

export const Compare: React.FC = () => {
  const [inputPattern, setInputPattern] = useState<string>('');
  const [activePattern, setActivePattern] = useState<string>('');

  const { data: matchedRules, loading } = useResource<RuleRow[]>(
    activePattern ? `/api/rules?pattern=${encodeURIComponent(activePattern)}` : null
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPattern.trim()) {
      setActivePattern(inputPattern.trim());
    }
  };

  return (
    <VStack gap={4}>
      <PageHeader
        eyebrow="ПОРІВНЯННЯ"
        title="Порівняння правил"
        subtitle="Аналіз версій правил для однакових патернів"
      />

      <Card padding={4}>
        <form onSubmit={handleSubmit} className="flex-row gap-sm items-center">
          <input
            type="text"
            placeholder="Введіть патерн (напр. select_gender)..."
            value={inputPattern}
            onChange={(e) => setInputPattern(e.target.value)}
            className="input-standard flex-1"
          />
          <Button variant="primary" type="submit">
            Порівняти
          </Button>
        </form>
      </Card>

      {loading && (
        <Card padding={4}>
          <div className="text-center text-xs text-tertiary">Пошук правил для порівняння...</div>
        </Card>
      )}

      {matchedRules && matchedRules.length === 0 && (
        <Card padding={4}>
          <EmptyState
            title="Правил не знайдено"
            description={`Для патерну '${activePattern}' немає зареєстрованих правил.`}
          />
        </Card>
      )}

      {matchedRules && matchedRules.length > 0 && (
        <div className="grid-responsive">
          {matchedRules.map((rule) => (
            <Card key={rule.id} padding={4}>
              <div className="flex-between mb-sm">
                <span className="text-sm text-bold text-primary">Правило #{rule.id}</span>
                <RuleStatusPill status={rule.status} />
              </div>
              <div className="flex-col gap-xs text-xs">
                <div><strong>Хост:</strong> {rule.host}</div>
                <div><strong>Персона:</strong> {rule.persona}</div>
                <div><strong>Джерело:</strong> {rule.source}</div>
                <div><strong>Впевненість:</strong> {Math.round(rule.confidence * 100)}%</div>
                <div className="p-sm bg-subtle rounded-md border-default mt-xs">
                  {rule.behavior}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </VStack>
  );
};
