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
