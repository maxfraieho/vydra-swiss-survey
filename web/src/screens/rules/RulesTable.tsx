import React, { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useResource } from '../../api/hooks';
import { useIsNarrow } from '../../shell/useIsNarrow';
import { RuleDetail } from './RuleDetail';
import { RuleComposer } from './RuleComposer';
import { Markdown } from '@astryxdesign/core/Markdown';
import { Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from '@astryxdesign/core/Table';
import { Badge, type BadgeVariant } from '@astryxdesign/core/Badge';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';

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
  created_at?: string;
  effective?: boolean;
  shadowed_by?: number | null;
}

export const RulesTable: React.FC = () => {
  const isNarrow = useIsNarrow();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);
  const [composing, setComposing] = useState<boolean>(false);

  const hostFilter = searchParams.get('host') || '';
  const personaFilter = searchParams.get('persona') || '';
  const statusFilter = searchParams.get('status') || '';
  const sourceFilter = searchParams.get('source') || '';
  const qFilter = searchParams.get('q') || '';
  const sortFilter = searchParams.get('sort') || '';

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

        {(hostFilter || personaFilter || statusFilter || sourceFilter || qFilter || sortFilter) && (
          <button
            onClick={() => setSearchParams(new URLSearchParams())}
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

      {/* Main Grid: Table (left) + Inline RuleComposer (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : (composing ? '1fr 420px' : '1fr'), gap: '20px' }}>
        {/* Rules Table */}
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border-emphasized)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Heading level={2} style={{ fontSize: '15px' }}>
              База Правил ({rules?.length || 0})
            </Heading>
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

          {rules && rules.length > 0 && isNarrow && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              {rules.map((r) => {
                const isSelected = selectedRuleId === r.id;
                const statusVariant: BadgeVariant = r.status === 'active' ? 'success' : r.status === 'shadow' ? 'warning' : 'neutral';
                return (
                  <ClickableCard
                    key={r.id}
                    label={`Правило #${r.id}`}
                    onClick={() => {
                      setSelectedRuleId(r.id);
                      setComposing(false);
                    }}
                    style={{ background: isSelected ? 'var(--color-background-muted)' : undefined }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'monospace', color: 'var(--color-text-disabled)' }}>#{r.id}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {r.effective ? (
                          <span style={{ fontSize: '12px', color: 'var(--color-text-blue)' }}>✅ win</span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--color-text-red)' }}>⚠️ #{r.shadowed_by}</span>
                        )}
                        <Badge variant={statusVariant} label={r.status} />
                      </div>
                    </div>
                    <MetadataList columns={1} label={{ position: 'start' }}>
                      <MetadataListItem label="Хост">{r.host}</MetadataListItem>
                      <MetadataListItem label="Патерн">{r.pattern}</MetadataListItem>
                      <MetadataListItem label="Conf">{r.confidence}</MetadataListItem>
                    </MetadataList>
                    <div style={{ marginTop: '8px' }}>
                      <Markdown density="compact" headingLevelStart={4}>{r.behavior}</Markdown>
                    </div>
                  </ClickableCard>
                );
              })}
            </div>
          )}

          {rules && rules.length > 0 && !isNarrow && (
            <Table hasHover density="compact">
              <TableHeader>
                <TableRow isHeaderRow>
                  <TableHeaderCell style={{ width: '50px' }}>ID</TableHeaderCell>
                  <TableHeaderCell style={{ width: '90px' }}>Хост</TableHeaderCell>
                  <TableHeaderCell style={{ width: '110px' }}>Патерн</TableHeaderCell>
                  <TableHeaderCell style={{ width: 'auto' }}>Поведінка</TableHeaderCell>
                  <TableHeaderCell style={{ width: '90px' }}>Статус</TableHeaderCell>
                  <TableHeaderCell style={{ width: '70px' }}>Ефект</TableHeaderCell>
                  <TableHeaderCell style={{ width: '50px' }}>Conf</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => {
                  const isSelected = selectedRuleId === r.id;
                  const statusVariant: BadgeVariant = r.status === 'active' ? 'success' : r.status === 'shadow' ? 'warning' : 'neutral';
                  return (
                    <TableRow
                      key={r.id}
                      onClick={() => {
                        setSelectedRuleId(r.id);
                        setComposing(false);
                      }}
                      style={{ cursor: 'pointer', background: isSelected ? 'var(--color-background-muted)' : undefined }}
                    >
                      <TableCell style={{ fontFamily: 'monospace', color: 'var(--color-text-disabled)' }}>#{r.id}</TableCell>
                      <TableCell style={{ color: '#e2e8f0', fontWeight: 600 }}>{r.host}</TableCell>
                      <TableCell style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{r.pattern}</TableCell>
                      <TableCell style={{ whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>
                        <Markdown density="compact" headingLevelStart={4}>{r.behavior}</Markdown>
                      </TableCell>
                      <TableCell><Badge variant={statusVariant} label={r.status} /></TableCell>
                      <TableCell>
                        {r.effective ? (
                          <span style={{ fontSize: '12px', color: 'var(--color-text-blue)' }}>✅ win</span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--color-text-red)' }}>⚠️ #{r.shadowed_by}</span>
                        )}
                      </TableCell>
                      <TableCell style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>{r.confidence}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Inline Panel for RuleComposer */}
        {composing && (
          <div>
            <RuleComposer
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

      <RuleDetail ruleId={selectedRuleId} onClose={() => setSelectedRuleId(null)} />
    </VStack>
  );
};
