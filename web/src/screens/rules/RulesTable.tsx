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
            background: '#020617',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#f8fafc',
            fontSize: '13px',
          }}
        />

        <select
          value={hostFilter}
          onChange={(e) => updateParam('host', e.target.value)}
          style={{
            background: '#020617',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#f8fafc',
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
            background: '#020617',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#f8fafc',
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
            background: '#020617',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#f8fafc',
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
            background: '#020617',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#f8fafc',
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
            background: '#020617',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#f8fafc',
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
              background: '#334155',
              color: '#f8fafc',
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

      {/* Main Grid: Table (left) + Master-Detail (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : ((selectedRuleId || composing) ? '1fr 420px' : '1fr'), gap: '20px' }}>
        {/* Rules Table */}
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Heading level={2} style={{ fontSize: '15px' }}>
              База Правил ({rules?.length || 0})
            </Heading>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {rulesLoading && <span style={{ fontSize: '12px', color: '#94a3b8' }}>Оновлення...</span>}
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
                  border: '1px solid #38bdf8',
                  background: '#1e293b',
                  color: '#38bdf8',
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
            <div style={{ padding: '20px', color: '#f87171', fontSize: '13px' }}>
              Помилка завантаження правил: {rulesError.message}
            </div>
          )}

          {!rulesLoading && rules && rules.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              Правил за вказаними фільтрами не знайдено.
            </div>
          )}

          {rules && rules.length > 0 && (
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
                      style={{ cursor: 'pointer', background: isSelected ? '#1e293b' : undefined }}
                    >
                      <TableCell style={{ fontFamily: 'monospace', color: '#94a3b8' }}>#{r.id}</TableCell>
                      <TableCell style={{ color: '#e2e8f0', fontWeight: 600 }}>{r.host}</TableCell>
                      <TableCell style={{ color: '#f8fafc', fontWeight: 600 }}>{r.pattern}</TableCell>
                      <TableCell style={{ whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>
                        <Markdown density="compact" headingLevelStart={4}>{r.behavior}</Markdown>
                      </TableCell>
                      <TableCell><Badge variant={statusVariant} label={r.status} /></TableCell>
                      <TableCell>
                        {r.effective ? (
                          <span style={{ fontSize: '11px', color: '#60a5fa' }}>✅ win</span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#f87171' }}>⚠️ #{r.shadowed_by}</span>
                        )}
                      </TableCell>
                      <TableCell style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{r.confidence}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Master-Detail Side Panel */}
        {(selectedRuleId || composing) && (
          <div>
            {composing ? (
              <RuleComposer
                onCreated={(result) => {
                  setComposing(false);
                  setSelectedRuleId(result.id);
                  refetchRules();
                }}
                onCancel={() => setComposing(false)}
              />
            ) : selectedRuleId ? (
              <RuleDetail ruleId={selectedRuleId} onClose={() => setSelectedRuleId(null)} />
            ) : null}
          </div>
        )}
      </div>
    </VStack>
  );
};
