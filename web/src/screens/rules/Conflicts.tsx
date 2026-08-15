import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { resolveConflictGroup, ConflictGroup } from '../../api/rules';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Selector } from '@astryxdesign/core/Selector';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { useToast } from '@astryxdesign/core/Toast';
import { PageHeader, EmptyState } from '../../ui/primitives';

interface ConflictsData {
  count: number;
  conflicts: ConflictGroup[];
}

export const Conflicts: React.FC = () => {
  const toast = useToast();
  const { data, loading, refetch } = useResource<ConflictsData>('/api/rules/conflicts');

  const [loserAction, setLoserAction] = useState<'retire' | 'delete'>('retire');
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [busyGroupId, setBusyGroupId] = useState<number | null>(null);

  const handleResolve = async (group: ConflictGroup, winnerId: number, groupIndex: number) => {
    setBusyGroupId(groupIndex);
    try {
      await resolveConflictGroup({
        host: group.host,
        persona: group.persona,
        pattern: group.pattern,
        winner_rule_id: winnerId,
        loser_action: loserAction,
        note: resolutionNote.trim() || undefined,
      });
      toast.show({ variant: 'success', title: `Конфлікт розв'язано: Правило #${winnerId} вибрано як переможець` });
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Не вдалося розв’язати конфлікт', description: msg });
    } finally {
      setBusyGroupId(null);
    }
  };

  return (
    <VStack gap={4}>
      <PageHeader
        eyebrow="КОНФЛІКТИ"
        title="Конфлікти правил (Rule Conflicts)"
        subtitle="Групи (host, persona, pattern), які мають різну поведінку від різних джерел"
        actions={
          <Badge
            variant={data && data.count > 0 ? 'error' : 'success'}
            label={`${data?.count || 0} Конфліктів`}
          />
        }
      />

      {data && data.conflicts.length > 0 && (
        <Card padding={4}>
          <div className="flex-row flex-wrap gap-md items-center">
            <div className="min-w-0 min-w-240">
              <Selector
                label="Дія для програвших правил"
                value={loserAction}
                onChange={(v) => setLoserAction((v as 'retire' | 'delete') || 'retire')}
                options={[
                  { value: 'retire', label: 'Retire (перевести у retired)' },
                  { value: 'delete', label: 'Delete (видалити з БД)' },
                ]}
              />
            </div>
            <input
              type="text"
              placeholder="Примітка рішення (необов'язково)..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              className="input-standard flex-1"
            />
          </div>
        </Card>
      )}

      {data && data.conflicts.length === 0 ? (
        <Card padding={5}>
          <EmptyState
            title="Конфліктів не виявлено"
            description="Усі правила між джерелами узгоджені!"
          />
        </Card>
      ) : (
        <VStack gap={4}>
          {data?.conflicts.map((group, idx) => (
            <Card key={idx} padding={4}>
              <div className="flex-between flex-wrap gap-sm mb-sm">
                <div className="flex-row items-center gap-md">
                  <Badge variant="error" label={`КОНФЛІКТ #${idx + 1}`} />
                  <span className="text-sm text-primary text-bold">
                    {group.host} • {group.persona} • <code className="text-accent">{group.pattern}</code>
                  </span>
                </div>
                <span className="text-xs text-tertiary">
                  Правил у конфлікті: {group.rules.length}
                </span>
              </div>

              <div className="flex-col gap-sm">
                {group.rules.map((rule) => (
                  <div key={rule.id} className="p-sm bg-subtle rounded-md border-default flex-between flex-wrap gap-sm">
                    <div className="flex-col gap-xs">
                      <div className="flex-row items-center gap-sm">
                        <span className="text-sm text-bold text-primary">#{rule.id}</span>
                        <Badge variant="neutral" label={rule.source} />
                        <span className="text-xs text-secondary">Впевненість: {Math.round(rule.confidence * 100)}%</span>
                      </div>
                      <div className="text-xs text-primary">{rule.behavior}</div>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busyGroupId === idx}
                      onClick={() => handleResolve(group, rule.id, idx)}
                    >
                      Вибрати переможцем
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </VStack>
      )}
    </VStack>
  );
};
