import { apiFetch } from './client';

export interface HostRow {
  id: number;
  hostname: string;
  label: string | null;
  provider_id: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderRow {
  id: number;
  key: string;
  label: string;
  url_pattern: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonaRow {
  id: number;
  key: string;
  label: string;
  content_md: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface PatternRow {
  id: number;
  key: string;
  label: string | null;
  keywords: string;
  qualifying_polarity: string | null;
  is_builtin: number;
  created_at: string;
  updated_at: string;
}

export interface CreateHostFormValues {
  hostname: string;
  label?: string;
  provider_id?: number;
  note?: string;
}

export interface UpdateHostFormValues {
  hostname?: string;
  label?: string;
  provider_id?: number | null;
  note?: string;
}

export interface CreateProviderFormValues {
  key: string;
  label: string;
  url_pattern?: string;
  note?: string;
}

export interface UpdateProviderFormValues {
  key?: string;
  label?: string;
  url_pattern?: string | null;
  note?: string;
}

export interface CreatePersonaFormValues {
  key: string;
  label: string;
  content_md?: string;
  active?: number;
}

export interface UpdatePersonaFormValues {
  label?: string;
  content_md?: string;
  active?: number;
}

export interface CreatePatternFormValues {
  key: string;
  label?: string;
  keywords?: string[];
  qualifying_polarity?: string;
}

export interface UpdatePatternFormValues {
  label?: string;
  keywords?: string[];
  qualifying_polarity?: string;
}

// Hosts API
export function listHosts(): Promise<HostRow[]> {
  return apiFetch<HostRow[]>('/api/settings/hosts');
}

export function createHost(v: CreateHostFormValues): Promise<HostRow> {
  return apiFetch<HostRow>('/api/settings/hosts', {
    method: 'POST',
    body: JSON.stringify({
      hostname: v.hostname.trim(),
      label: v.label?.trim() || undefined,
      provider_id: v.provider_id || undefined,
      note: v.note?.trim() || undefined,
    }),
  });
}

export function updateHost(id: number, v: UpdateHostFormValues): Promise<HostRow> {
  return apiFetch<HostRow>(`/api/settings/hosts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      hostname: v.hostname !== undefined ? v.hostname.trim() : undefined,
      label: v.label !== undefined ? v.label.trim() : undefined,
      provider_id: v.provider_id,
      note: v.note !== undefined ? v.note.trim() : undefined,
    }),
  });
}

export function deleteHost(id: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/settings/hosts/${id}`, {
    method: 'DELETE',
  });
}

// Providers API
export function listProviders(): Promise<ProviderRow[]> {
  return apiFetch<ProviderRow[]>('/api/settings/providers');
}

export function createProvider(v: CreateProviderFormValues): Promise<ProviderRow> {
  return apiFetch<ProviderRow>('/api/settings/providers', {
    method: 'POST',
    body: JSON.stringify({
      key: v.key.trim(),
      label: v.label.trim(),
      url_pattern: v.url_pattern?.trim() || undefined,
      note: v.note?.trim() || undefined,
    }),
  });
}

export function updateProvider(id: number, v: UpdateProviderFormValues): Promise<ProviderRow> {
  return apiFetch<ProviderRow>(`/api/settings/providers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      key: v.key !== undefined ? v.key.trim() : undefined,
      label: v.label !== undefined ? v.label.trim() : undefined,
      url_pattern: v.url_pattern !== undefined ? v.url_pattern?.trim() || null : undefined,
      note: v.note !== undefined ? v.note?.trim() || null : undefined,
    }),
  });
}

export function deleteProvider(id: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/settings/providers/${id}`, {
    method: 'DELETE',
  });
}

// Personas API
export function listPersonas(): Promise<PersonaRow[]> {
  return apiFetch<PersonaRow[]>('/api/settings/personas');
}

export function createPersona(v: CreatePersonaFormValues): Promise<PersonaRow> {
  return apiFetch<PersonaRow>('/api/settings/personas', {
    method: 'POST',
    body: JSON.stringify({
      key: v.key.trim(),
      label: v.label.trim(),
      content_md: v.content_md !== undefined ? v.content_md : '',
      active: v.active !== undefined ? v.active : 1,
    }),
  });
}

export function updatePersona(key: string, v: UpdatePersonaFormValues): Promise<PersonaRow> {
  return apiFetch<PersonaRow>(`/api/settings/personas/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      label: v.label !== undefined ? v.label.trim() : undefined,
      content_md: v.content_md,
      active: v.active,
    }),
  });
}

export function deletePersona(key: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/settings/personas/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
}

// Patterns API
export function listPatterns(): Promise<PatternRow[]> {
  return apiFetch<PatternRow[]>('/api/settings/patterns');
}

export function createPattern(v: CreatePatternFormValues): Promise<PatternRow> {
  return apiFetch<PatternRow>('/api/settings/patterns', {
    method: 'POST',
    body: JSON.stringify({
      key: v.key.trim(),
      label: v.label?.trim() || undefined,
      keywords: v.keywords ? JSON.stringify(v.keywords) : undefined,
      qualifying_polarity: v.qualifying_polarity || undefined,
    }),
  });
}

export function updatePattern(key: string, v: UpdatePatternFormValues): Promise<PatternRow> {
  return apiFetch<PatternRow>(`/api/settings/patterns/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      label: v.label !== undefined ? v.label.trim() : undefined,
      keywords: v.keywords !== undefined ? JSON.stringify(v.keywords) : undefined,
      qualifying_polarity: v.qualifying_polarity !== undefined ? v.qualifying_polarity : undefined,
    }),
  });
}

export function deletePattern(key: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/settings/patterns/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
}

// AI Source API
export interface AISourceConfig {
  backend: 'proxy' | 'local';
  base_url: string;
  model: string;
  token_configured: boolean;
}

export interface UpdateAISourceFormValues {
  backend: 'proxy' | 'local';
  base_url?: string;
  model?: string;
  token?: string;
}

export interface AISourceTestResult {
  ok: boolean;
  detail: string;
}

export interface ProbeModelResult {
  model: string;
  vision_capable: boolean;
  detail: string;
}

export interface ProbeStatus {
  status: 'idle' | 'running' | 'finished' | 'error';
  progress: number;
  total: number;
  results: ProbeModelResult[];
  error?: string | null;
}

export function getAISourceConfig(): Promise<AISourceConfig> {
  return apiFetch<AISourceConfig>('/api/settings/ai-source');
}

export function updateAISourceConfig(v: UpdateAISourceFormValues): Promise<AISourceConfig> {
  return apiFetch<AISourceConfig>('/api/settings/ai-source', {
    method: 'PUT',
    body: JSON.stringify(v),
  });
}

export function testAISourceConfig(v?: Partial<UpdateAISourceFormValues>): Promise<AISourceTestResult> {
  return apiFetch<AISourceTestResult>('/api/settings/ai-source/test', {
    method: 'POST',
    body: v ? JSON.stringify(v) : undefined,
  });
}

export function probeModels(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>('/api/settings/ai-source/probe-models', {
    method: 'POST',
  });
}

export function getProbeStatus(): Promise<ProbeStatus> {
  return apiFetch<ProbeStatus>('/api/settings/ai-source/probe-status');
}

