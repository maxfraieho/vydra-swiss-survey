import React from 'react';
import { Selector } from '@astryxdesign/core/Selector';
import { Card } from '@astryxdesign/core/Card';
import type { FacetsData } from './RulesTable';

export interface RulesFiltersProps {
  hostFilter: string;
  personaFilter: string;
  statusFilter: string;
  sourceFilter: string;
  facets?: FacetsData | null;
  onUpdateParam: (key: string, val: string) => void;
}

export const RulesFilters: React.FC<RulesFiltersProps> = ({
  hostFilter,
  personaFilter,
  statusFilter,
  sourceFilter,
  facets,
  onUpdateParam,
}) => {
  return (
    <Card padding={3}>
      <div className="grid-responsive">
        <Selector
          label="Хост"
          value={hostFilter || 'all'}
          onChange={(v) => onUpdateParam('host', v)}
          options={[
            { value: 'all', label: 'Усі хости' },
            ...(facets?.hosts || []).map((h) => ({ value: h.name, label: `${h.name} (${h.count})` })),
          ]}
        />

        <Selector
          label="Персона"
          value={personaFilter || 'all'}
          onChange={(v) => onUpdateParam('persona', v)}
          options={[
            { value: 'all', label: 'Усі персони' },
            ...(facets?.personas || []).map((p) => ({ value: p.name, label: `${p.name} (${p.count})` })),
          ]}
        />

        <Selector
          label="Статус"
          value={statusFilter || 'all'}
          onChange={(v) => onUpdateParam('status', v)}
          options={[
            { value: 'all', label: 'Усі статуси' },
            { value: 'active', label: 'Діє (Active)' },
            { value: 'shadow', label: 'На випробуванні (Shadow)' },
            { value: 'retired', label: 'Застаріле (Retired)' },
          ]}
        />

        <Selector
          label="Джерело"
          value={sourceFilter || 'all'}
          onChange={(v) => onUpdateParam('source', v)}
          options={[
            { value: 'all', label: 'Усі джерела' },
            ...(facets?.sources || []).map((s) => ({ value: s.name, label: `${s.name} (${s.count})` })),
          ]}
        />
      </div>
    </Card>
  );
};
