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
      host: v.host.trim(), persona: v.persona.trim() || '*',
      pattern: v.pattern.trim(), behavior: v.behavior.trim(),
      confidence: v.confidence, status: v.status,
      note: v.note?.trim() || undefined,
    }),
  });
}

export function updateRule(id: number, v: RuleFormValues) {
  return apiFetch<RuleDetailData>(`/api/rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      behavior: v.behavior.trim(), confidence: v.confidence,
      status: v.status, note: v.note?.trim() || undefined,
    }),
  });
}

export function fetchRule(id: number) {
  return apiFetch<RuleDetailData>(`/api/rules/${id}`);
}

export interface HostGateData {
  host: string;
  playbook_mode: 'shadow' | 'active' | 'off';
  gated_by: string | null;
  unreviewed_shadow_rules: number;
  conflicts_count: number;
  missing_evidence_rules: number;
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

export function resolveConflict(
  ruleId: number,
  options: { winner_id: number; loser_action: 'retire' | 'delete'; note?: string }
): Promise<{ winner_id: number; loser_ids: number[]; loser_action: string }> {
  return apiFetch(`/api/rules/${ruleId}/resolve_conflict`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
}

export function bulkUpdateRules(
  ids: number[],
  op: 'promote' | 'retire' | 'delete',
  note?: string
): Promise<{ op: string; requested: number; changed: number }> {
  return apiFetch<{ op: string; requested: number; changed: number }>('/api/rules/bulk', {
    method: 'POST',
    body: JSON.stringify({ ids, op, note: note?.trim() || undefined }),
  });
}



