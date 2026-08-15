import { apiFetch } from './client';
import { RuleDetailData } from '../screens/rules/RuleDetail';

export interface RuleFormValues {
  host: string;
  persona: string;
  pattern: string;
  behavior: string;
  confidence: number;
  status: 'active' | 'shadow' | 'retired';
  note?: string;
}

export function createRule(v: RuleFormValues) {
  return apiFetch<RuleDetailData>('/api/rules', {
    method: 'POST',
    body: JSON.stringify({
      host: v.host.trim(),
      persona: v.persona.trim() || '*',
      pattern: v.pattern.trim(),
      behavior: v.behavior.trim(),
      confidence: v.confidence,
      status: v.status,
      note: v.note?.trim() || undefined,
    }),
  });
}

export function updateRule(id: number, v: Partial<RuleFormValues>) {
  return apiFetch<RuleDetailData>(`/api/rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      behavior: v.behavior?.trim(),
      confidence: v.confidence,
      status: v.status,
      note: v.note?.trim() || undefined,
    }),
  });
}

export function fetchRule(id: number) {
  return apiFetch<RuleDetailData>(`/api/rules/${id}`);
}

export interface HostGateData {
  host: string;
  playbook_mode: 'shadow' | 'active' | 'off';
  gated_by?: string | null;
  unreviewed_shadow_rules?: number;
  shadow_rules_count: number;
  conflicts_count?: number;
  unresolved_conflicts: number;
  missing_evidence_rules?: number;
  total_rules: number;
  active_rules: number;
  retired_rules: number;
  has_completed_run: boolean;
  ready_for_active: boolean;
}

export function fetchHostGate(host: string): Promise<HostGateData> {
  return apiFetch<HostGateData>(`/api/gate/${encodeURIComponent(host)}`);
}

export function approveHostGate(
  host: string,
  options?: { playbook_mode?: string; promote_reviewed_shadow?: boolean; note?: string }
): Promise<{ host: string; playbook_mode: string; promoted_rule_ids: number[]; gate: any }> {
  return apiFetch(`/api/gate/${encodeURIComponent(host)}/approve`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
}

export interface ConflictRule {
  id: number;
  host: string;
  persona: string;
  pattern: string;
  behavior: string;
  source: string;
  status: 'active' | 'shadow' | 'retired';
  confidence: number;
}

export interface ConflictGroup {
  host: string;
  persona: string;
  pattern: string;
  rules: ConflictRule[];
}

export function resolveConflict(
  ruleId: number,
  options: { winner_id: number; loser_action: 'retire' | 'delete'; note?: string }
): Promise<{ winner_id: number; loser_ids: number[]; loser_action: string }> {
  return apiFetch(`/api/rules/${ruleId}/resolve_conflict`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
}

export function resolveConflictGroup(options: {
  host: string;
  persona: string;
  pattern: string;
  winner_rule_id: number;
  loser_action: 'retire' | 'delete';
  note?: string;
}): Promise<{ ok: boolean }> {
  return apiFetch('/api/rules/conflicts/resolve', {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

export function bulkUpdateRules(
  args: { rule_ids: number[]; action: 'promote' | 'retire' | 'delete'; note?: string } | number[],
  op?: 'promote' | 'retire' | 'delete',
  note?: string
): Promise<{ op: string; requested: number; changed: number }> {
  if (Array.isArray(args)) {
    return apiFetch<{ op: string; requested: number; changed: number }>('/api/rules/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids: args, op, note: note?.trim() || undefined }),
    });
  }
  return apiFetch<{ op: string; requested: number; changed: number }>('/api/rules/bulk', {
    method: 'POST',
    body: JSON.stringify({ ids: args.rule_ids, op: args.action, note: args.note?.trim() || undefined }),
  });
}
