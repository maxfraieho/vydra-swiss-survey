import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { resolveConflict } from '../../api/rules';
import { RuleRow } from './RulesTable';
import { Markdown } from '@astryxdesign/core/Markdown';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { useToast } from '@astryxdesign/core/Toast';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';

export interface ConflictGroup {
  host: string;
  persona: string;
  pattern: string;
  count: number;
  rules: RuleRow[];
}

export interface ConflictsResponse {
  count: number;
  conflicts: ConflictGroup[];
}

export const Conflicts: React.FC = () => {
  const toast = useToast();
  const { data, loading, error, refetch } = useResource<ConflictsResponse>('/api/rules/conflicts');

  const [busyRuleId, setBusyRuleId] = useState<number | null>(null);
  const [loserAction, setLoserAction] = useState<'retire' | 'delete'>('retire');
  const [resolutionNote, setResolutionNote] = useState<string>('');

  const handleResolve = async (ruleId: number, winnerId: number) => {
    setBusyRuleId(winnerId);
    try {
      await resolveConflict(ruleId, {
        winner_id: winnerId,
        loser_action: loserAction,
        note: resolutionNote.trim() || undefined,
      });
      toast({ body: `Конфлікт вирішено! Правило #${winnerId} обрано переможцем (active).` });
      setResolutionNote('');
      refetch();
    } catch (err: any) {
      toast({ body: err?.message || 'Помилка при вирішенні конфлікту', type: 'error' });
    } finally {
      setBusyRuleId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: '13px' }}>
        Завантаження перевірки конфліктів джерел...
      </div>
    );
  }

  if (error) {
    return (
      <Card padding={5}>
        <Text type="body" style={{ color: 'var(--color-text-red)' }}>Помилка перевірки конфліктів: {error.message}</Text>
      </Card>
    );
  }

  return (
    <VStack gap={5}>
      <Card padding={5}>
        <HStack justify="between" align="center">
          <div>
            <Heading level={2} style={{ marginBottom: '4px' }}>
              ⚔️ Конфлікти джерел знань (Source Conflicts)
            </Heading>
            <Text type="body" color="secondary" display="block">
              Групи (host, persona, pattern), які мають різну поведінку від різних джерел.
            </Text>
          </div>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              background: data && data.count > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: `1px solid ${data && data.count > 0 ? 'var(--color-border-red)' : '#059669'}`,
              color: data && data.count > 0 ? 'var(--color-text-red)' : 'var(--color-text-green)',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            {data?.count || 0} Конфліктів
          </div>
        </HStack>
      </Card>

      {/* Global Resolution Settings Bar */}
      {data && data.conflicts.length > 0 && (
        <Card padding={4} style={{ background: 'var(--color-background-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '240px' }}>
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
              style={{
                flex: '1 1 200px',
                background: 'var(--color-background-page)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: 'var(--color-text-primary)',
                fontSize: '13px',
              }}
            />
          </div>
        </Card>
      )}

      {data && data.conflicts.length === 0 ? (
        <Card padding={5}>
          <Text type="body" display="block" style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-green)', fontWeight: 600 }}>
            ✅ Конфліктів між джерелами не виявлено. Усі правила узгоджені!
          </Text>
        </Card>
      ) : (
        <VStack gap={4}>
          {data?.conflicts.map((group, idx) => (
            <Card key={idx} padding={4}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: '#ef4444', color: '#fff', textTransform: 'uppercase' }}>
                    КОНФЛІКТ #{idx + 1}
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                    {group.host} • {group.persona} • <code style={{ color: 'var(--color-accent)' }}>{group.pattern}</code>
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                  Правил у конфлікті: {group.rules.length}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {group.rules.map((r) => {
                  const isBusy = busyRuleId === r.id;
                  return (
                    <Card key={r.id} padding={4} style={{ border: r.effective ? '1px solid var(--color-border-blue)' : undefined }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontFamily: 'monospace', color: 'var(--color-text-disabled)' }}>#{r.id}</span>
                        {r.effective ? (
                          <span style={{ color: 'var(--color-text-blue)', fontWeight: 700, fontSize: '12px', background: 'rgba(59, 130, 246, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                            🏆 WINNER (effective)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-red)', fontSize: '12px', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                            ⚠️ Shadowed by #{r.shadowed_by}
                          </span>
                        )}
                      </div>

                      <MetadataList columns={1} label={{ position: 'start' }}>
                        <MetadataListItem label="Джерело">{r.source}</MetadataListItem>
                        <MetadataListItem label="Status">{r.status}</MetadataListItem>
                        <MetadataListItem label="Conf">{r.confidence}</MetadataListItem>
                      </MetadataList>

                      <div style={{ marginTop: '8px', marginBottom: '12px' }}>
                        <Markdown density="compact" headingLevelStart={4}>{r.behavior}</Markdown>
                      </div>

                      <div style={{ paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          type="button"
                          variant={r.effective ? 'secondary' : 'primary'}
                          size="sm"
                          label={isBusy ? 'Збереження...' : r.effective ? 'Підтвердити як Winner' : '🏆 Обрати переможцем'}
                          onClick={() => handleResolve(group.rules[0].id, r.id)}
                          isDisabled={isBusy}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </Card>
          ))}
        </VStack>
      )}
    </VStack>
  );
};
