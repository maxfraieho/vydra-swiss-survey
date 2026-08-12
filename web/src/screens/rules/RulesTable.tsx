import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useResource } from '../../api/hooks';
import { useIsNarrow } from '../../shell/useIsNarrow';
import { RuleDetail } from './RuleDetail';
import { RuleComposer } from './RuleComposer';
import { bulkUpdateRules } from '../../api/rules';
import { Markdown } from '@astryxdesign/core/Markdown';
import { Badge, type BadgeVariant } from '@astryxdesign/core/Badge';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { Dialog } from '@astryxdesign/core/Dialog';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { useToast } from '@astryxdesign/core/Toast';

export interface FacetsData {
  hosts: { name: string; count: number; by_status: Record<string, number> }[];
  personas: { name: string; count: number; by_status: Record<string, number> }[];
  sources: { name: string; count: number; by_status: Record<string, number> }[];
}

export interface RuleRow {
  id: number;
  host: string;
  persona: string;
  pattern: string;
  behavior: string;
  source: string;
  status: 'active' | 'shadow' | 'retired';
  confidence: number;
  hits?: number;
  wins?: number;
  losses?: number;
  confirmed_runs?: number;
  created_at?: string;
  effective?: boolean;
  shadowed_by?: number | null;
}

export const RulesTable: React.FC = () => {
  const isNarrow = useIsNarrow();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);
  const [composing, setComposing] = useState<boolean>(false);
  const [groupBy, setGroupBy] = useState<'none' | 'host' | 'persona'>('none');

  const [checkedRuleIds, setCheckedRuleIds] = useState<number[]>([]);
  const [bulkNote, setBulkNote] = useState<string>('');
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);

  const hostFilter = searchParams.get('host') || '';
  const personaFilter = searchParams.get('persona') || '';
  const statusFilter = searchParams.get('status') || '';
  const sourceFilter = searchParams.get('source') || '';
  const qFilter = searchParams.get('q') || '';
  const sortFilter = searchParams.get('sort') || '';
  const isNewParam = searchParams.get('new') === 'true';
  const patternParam = searchParams.get('pattern') || '';

  // Auto open composer if URL has new=true
  useEffect(() => {
    if (isNewParam) {
      setComposing(true);
    }
  }, [isNewParam]);

  const queryParams = new URLSearchParams();
  if (hostFilter) queryParams.set('host', hostFilter);
  if (personaFilter) queryParams.set('persona', personaFilter);
  if (statusFilter) queryParams.set('status', statusFilter);
  if (sourceFilter) queryParams.set('source', sourceFilter);
  if (qFilter) queryParams.set('q', qFilter);
  if (sortFilter) queryParams.set('sort', sortFilter);

  const rulesEndpoint = `/api/rules?${queryParams.toString()}`;

  const { data: rules, loading: rulesLoading, error: rulesError, refetch: refetchRules } = useResource<RuleRow[]>(rulesEndpoint);
  const { data: facets } = useResource<FacetsData>('/api/rules/facets');

  const updateParam = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  // Grouping logic
  const groupedRules = useMemo(() => {
    if (!rules || groupBy === 'none') return null;

    const map = new Map<string, RuleRow[]>();
    for (const r of rules) {
      const key = groupBy === 'host' ? r.host || '*' : r.persona || '*';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).map(([groupKey, items]) => ({
      groupKey,
      items,
    }));
  }, [rules, groupBy]);

  const toggleCheckRule = (id: number, checked: boolean) => {
    setCheckedRuleIds((prev) =>
      checked ? [...prev, id] : prev.filter((i) => i !== id)
    );
  };

  const toggleCheckGroup = (groupItemIds: number[]) => {
    const allChecked = groupItemIds.every((id) => checkedRuleIds.includes(id));
    if (allChecked) {
      setCheckedRuleIds((prev) => prev.filter((id) => !groupItemIds.includes(id)));
    } else {
      setCheckedRuleIds((prev) => Array.from(new Set([...prev, ...groupItemIds])));
    }
  };

  const handleBulkAction = async (op: 'promote' | 'retire' | 'delete') => {
    if (checkedRuleIds.length === 0) return;
    if (op === 'delete') {
      const confirmMsg = `Ви дійсно бажаєте видалити ${checkedRuleIds.length} правил? Цю дію неможливо скасувати.`;
      if (!window.confirm(confirmMsg)) return;
    }
    setBulkBusy(true);
    try {
      const res = await bulkUpdateRules(checkedRuleIds, op, bulkNote);
      toast({ body: `Масова операція (${op}): змінено ${res.changed} з ${res.requested} правил` });
      setCheckedRuleIds([]);
      setBulkNote('');
      refetchRules();
    } catch (err: any) {
      toast({ body: err?.message || 'Помилка виконання масової операції', type: 'error' });
    } finally {
      setBulkBusy(false);
    }
  };

  const renderRuleCard = (r: RuleRow) => {
    const isSelected = selectedRuleId === r.id;
    const isChecked = checkedRuleIds.includes(r.id);
    const statusVariant: BadgeVariant = r.status === 'active' ? 'success' : r.status === 'shadow' ? 'warning' : 'neutral';
    return (
      <ClickableCard
        key={r.id}
        label={`Правило #${r.id}`}
        onClick={() => {
          setSelectedRuleId(r.id);
          setComposing(false);
        }}
        style={{
          background: isSelected ? 'var(--color-background-muted)' : undefined,
          border: isChecked ? '1px solid var(--color-accent)' : undefined,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={isChecked}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => toggleCheckRule(r.id, e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              title="Обрати правило"
            />
            <span style={{ fontFamily: 'monospace', color: 'var(--color-text-disabled)' }}>#{r.id}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {r.effective ? (
              <span style={{ fontSize: '12px', color: 'var(--color-text-blue)' }}>✅ win</span>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--color-text-red)' }}>⚠️ #{r.shadowed_by}</span>
            )}
            <Badge variant={statusVariant} label={r.status} />
            {r.confirmed_runs !== undefined && (
              <Badge variant="info" label={`Підтверджено: ${r.confirmed_runs}`} />
            )}
          </div>
        </div>
        <MetadataList columns={1} label={{ position: 'start' }}>
          <MetadataListItem label="Хост">{r.host}</MetadataListItem>
          <MetadataListItem label="Персона">{r.persona}</MetadataListItem>
          <MetadataListItem label="Патерн">{r.pattern}</MetadataListItem>
          <MetadataListItem label="Conf">{r.confidence}</MetadataListItem>
        </MetadataList>
        <div style={{ marginTop: '8px' }}>
          <Markdown density="compact" headingLevelStart={4}>{r.behavior}</Markdown>
        </div>
      </ClickableCard>
    );
  };

  return (
    <VStack gap={5}>
      {/* Search & Filter Bar */}
      <Card padding={4} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Пошук за патерном або поведінкою..."
          value={qFilter}
          onChange={(e) => updateParam('q', e.target.value)}
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

        <select
          value={hostFilter}
          onChange={(e) => updateParam('host', e.target.value)}
          style={{
            background: 'var(--color-background-page)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
          }}
        >
          <option value="">Усі Хости</option>
          {facets?.hosts.map((h) => (
            <option key={h.name} value={h.name}>
              {h.name} ({h.count})
            </option>
          ))}
        </select>

        <select
          value={personaFilter}
          onChange={(e) => updateParam('persona', e.target.value)}
          style={{
            background: 'var(--color-background-page)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
          }}
        >
          <option value="">Усі Персони</option>
          {facets?.personas.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} ({p.count})
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => updateParam('status', e.target.value)}
          style={{
            background: 'var(--color-background-page)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
          }}
        >
          <option value="">Усі Статуси</option>
          <option value="active">Active</option>
          <option value="shadow">Shadow</option>
          <option value="retired">Retired</option>
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => updateParam('source', e.target.value)}
          style={{
            background: 'var(--color-background-page)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
          }}
        >
          <option value="">Усі Джерела</option>
          {facets?.sources.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} ({s.count})
            </option>
          ))}
        </select>

        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as 'none' | 'host' | 'persona')}
          style={{
            background: 'var(--color-background-page)',
            border: '1px solid var(--color-accent)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--color-accent)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <option value="none">Групування: Без групування</option>
          <option value="host">Групувати за Хостом</option>
          <option value="persona">Групувати за Персоною</option>
        </select>

        <select
          value={sortFilter}
          onChange={(e) => updateParam('sort', e.target.value)}
          style={{
            background: 'var(--color-background-page)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
          }}
        >
          <option value="">Сортування за замовчуванням</option>
          <option value="confidence">За confidence</option>
          <option value="created_at">За датою</option>
          <option value="host">За хостом</option>
        </select>

        {(hostFilter || personaFilter || statusFilter || sourceFilter || qFilter || sortFilter || groupBy !== 'none') && (
          <button
            onClick={() => {
              setSearchParams(new URLSearchParams());
              setGroupBy('none');
              setCheckedRuleIds([]);
            }}
            style={{
              background: 'var(--color-border)',
              color: 'var(--color-text-primary)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Скинути фільтри
          </button>
        )}
      </Card>

      {/* Bulk Operations Action Bar */}
      {checkedRuleIds.length > 0 && (
        <Card
          padding={3}
          style={{
            background: 'var(--color-background-muted)',
            border: '1px solid var(--color-accent)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              ☑️ Обрано правил: {checkedRuleIds.length}
            </span>
            <input
              type="text"
              placeholder="Примітка аудиту (опціонально)"
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              style={{
                background: 'var(--color-background-page)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: 'var(--color-text-primary)',
                fontSize: '12px',
                width: '220px',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleBulkAction('promote')}
              disabled={bulkBusy}
              style={{
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Перевести статус обраних правил в active"
            >
              ⚡ Active (Promote)
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('retire')}
              disabled={bulkBusy}
              style={{
                background: '#f59e0b',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Перевести статус обраних правил в retired"
            >
              💤 Retire
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('delete')}
              disabled={bulkBusy}
              style={{
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Видалити обрані правила"
            >
              🗑️ Delete
            </button>
            <button
              type="button"
              onClick={() => setCheckedRuleIds([])}
              style={{
                background: 'transparent',
                color: 'var(--color-text-tertiary)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Скасувати вибір
            </button>
          </div>
        </Card>
      )}

      {/* Main Grid: Table (left) + Inline RuleComposer (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : (composing ? '1fr 420px' : '1fr'), gap: '20px' }}>
        {/* Rules Table */}
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border-emphasized)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Heading level={2} style={{ fontSize: '15px' }}>
                База Правил ({rules?.length || 0})
              </Heading>
              {rules && rules.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={rules.length > 0 && rules.every((r) => checkedRuleIds.includes(r.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCheckedRuleIds(rules.map((r) => r.id));
                      } else {
                        setCheckedRuleIds([]);
                      }
                    }}
                  />
                  Обрати всі ({rules.length})
                </label>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {rulesLoading && <span style={{ fontSize: '12px', color: 'var(--color-text-disabled)' }}>Оновлення...</span>}
              <button
                type="button"
                onClick={() => {
                  setComposing(true);
                  setSelectedRuleId(null);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--color-accent)',
                  background: 'var(--color-background-muted)',
                  color: 'var(--color-accent)',
                  transition: 'all 0.15s ease',
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                + Нове правило
              </button>
            </div>
          </div>

          {rulesError && (
            <div style={{ padding: '20px', color: 'var(--color-text-red)', fontSize: '13px' }}>
              Помилка завантаження правил: {rulesError.message}
            </div>
          )}

          {!rulesLoading && rules && rules.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '13px' }}>
              Правил за вказаними фільтрами не знайдено.
            </div>
          )}

          {/* Grouped view or flat view */}
          {rules && rules.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px' }}>
              {groupedRules ? (
                groupedRules.map((group) => (
                  <div key={group.groupKey} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      style={{
                        padding: '6px 12px',
                        background: 'var(--color-background-muted)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={group.items.length > 0 && group.items.every((r) => checkedRuleIds.includes(r.id))}
                          onChange={() => toggleCheckGroup(group.items.map((r) => r.id))}
                          style={{ cursor: 'pointer' }}
                          title="Обрати всі в цій групі"
                        />
                        <span>
                          {groupBy === 'host' ? `🌐 Хост: ${group.groupKey}` : `👤 Персона: ${group.groupKey}`}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                        {group.items.length} правил
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {group.items.map(renderRuleCard)}
                    </div>
                  </div>
                ))
              ) : (
                rules.map(renderRuleCard)
              )}
            </div>
          )}
        </Card>

        {/* Inline Panel for RuleComposer */}
        {composing && (
          <div>
            <RuleComposer
              initialHost={hostFilter}
              initialPersona={personaFilter || '*'}
              initialPattern={patternParam}
              initialBehavior={qFilter}
              onCreated={(result) => {
                setComposing(false);
                setSelectedRuleId(result.id);
                refetchRules();
              }}
              onCancel={() => setComposing(false)}
            />
          </div>
        )}
      </div>

      <RuleDetail
        ruleId={selectedRuleId}
        onClose={() => setSelectedRuleId(null)}
        onUpdated={() => refetchRules()}
      />
    </VStack>
  );
};

