import React, { useState } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router';
import { useResource } from '../../api/hooks';
import { RuleDetail } from './RuleDetail';
import { RuleComposer } from './RuleComposer';
import { RulesFilters } from './RulesFilters';
import { RulesBulkBar } from './RulesBulkBar';
import { bulkUpdateRules } from '../../api/rules';
import { VStack } from '@astryxdesign/core/VStack';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { useToast } from '@astryxdesign/core/Toast';
import { PageHeader, RuleStatusPill } from '../../ui/primitives';

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
  effective?: boolean;
}

export const RulesTable: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { ruleId: routeRuleId } = useParams<{ ruleId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [composing, setComposing] = useState(false);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const selectedRuleId = routeRuleId ? parseInt(routeRuleId, 10) : null;
  const hostFilter = searchParams.get('host') || '';
  const personaFilter = searchParams.get('persona') || '';
  const statusFilter = searchParams.get('status') || '';
  const sourceFilter = searchParams.get('source') || '';

  const queryParams = new URLSearchParams();
  if (hostFilter) queryParams.set('host', hostFilter);
  if (personaFilter) queryParams.set('persona', personaFilter);
  if (statusFilter) queryParams.set('status', statusFilter);
  if (sourceFilter) queryParams.set('source', sourceFilter);

  const { data: rules, refetch: refetchRules } = useResource<RuleRow[]>(`/api/rules?${queryParams.toString()}`);
  const { data: facets } = useResource<FacetsData>('/api/rules/facets');

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    const val = (value || '').trim().toLowerCase();
    if (val && val !== 'all') {
      next.set(key, value.trim());
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  };

  const handleBulkAction = async (action: 'promote' | 'retire' | 'delete') => {
    if (checkedIds.length === 0) return;
    setBulkBusy(true);
    try {
      await bulkUpdateRules({ rule_ids: checkedIds, action });
      toast.show({ variant: 'success', title: `Дію '${action}' виконано для ${checkedIds.length} правил` });
      setCheckedIds([]);
      refetchRules();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка масової дії', description: msg });
    } finally {
      setBulkBusy(false);
    }
  };

  const toggleCheck = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <VStack gap={4}>
      <PageHeader
        eyebrow="БАЗА ЗНАНЬ"
        title="Навички агента (Правила)"
        subtitle="Редагування, підтвердження та перевірка поведінкових правил"
        actions={
          <Button variant="primary" onClick={() => setComposing(true)}>
            + Додати правило
          </Button>
        }
      />

      <RulesFilters
        hostFilter={hostFilter}
        personaFilter={personaFilter}
        statusFilter={statusFilter}
        sourceFilter={sourceFilter}
        facets={facets}
        onUpdateParam={updateParam}
      />

      <RulesBulkBar
        selectedCount={checkedIds.length}
        bulkBusy={bulkBusy}
        onBulkAction={handleBulkAction}
        onClearSelection={() => setCheckedIds([])}
      />

      <div className="flex-col gap-sm">
        {(rules || []).length === 0 ? (
          <Card padding={4}>
            <div className="text-center text-tertiary text-sm">
              Правил за вказаними фільтрами не знайдено
            </div>
          </Card>
        ) : (
          (rules || []).map((r) => {
            const isChecked = checkedIds.includes(r.id);
            return (
              <Card key={r.id} padding={3}>
                <div
                  onClick={() => navigate(`/rules/${r.id}`)}
                  className="flex-between cursor-pointer flex-wrap gap-sm"
                >
                  <div className="flex-row gap-sm items-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onClick={(e) => toggleCheck(r.id, e)}
                      onChange={() => {}}
                    />
                    <RuleStatusPill status={r.status} />
                    <span className="text-sm text-bold text-mono text-accent">
                      {r.pattern}
                    </span>
                  </div>

                  <div className="flex-row gap-sm items-center">
                    <Badge variant="neutral" label={`${r.host} • ${r.persona}`} />
                    <span className="text-xs text-secondary">
                      {Math.round((r.confidence || 0) * 100)}%
                    </span>
                  </div>
                </div>

                <div className="text-xs text-secondary mt-xs pl-md">
                  {r.behavior}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <RuleDetail
        ruleId={selectedRuleId}
        onClose={() => navigate('/rules')}
        onUpdated={refetchRules}
      />

      <RuleComposer
        isOpen={composing}
        onClose={() => setComposing(false)}
        onCreated={refetchRules}
      />
    </VStack>
  );
};
