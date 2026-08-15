import { ApiError } from './errors';

let reloading = false;

export function getApiBase(): string {
  const pathname = window.location.pathname;
  const idx = pathname.indexOf('/app');
  if (idx > 0) {
    return pathname.substring(0, idx);
  }
  return '';
}

export function getAppBasename(): string {
  const pathname = window.location.pathname;
  const idx = pathname.indexOf('/app');
  if (idx !== -1) {
    return pathname.substring(0, idx + 4);
  }
  return '';
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const base = getApiBase();
  const url = `${base}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && !reloading) {
      reloading = true;
      location.reload();
    }
    let body: any = null;
    try { body = await response.json(); } catch { /* non-JSON error page */ }
    throw new ApiError(
      body?.error || `API error ${response.status}: ${response.statusText}`,
      response.status,
      body
    );
  }

  const contentType = response.headers.get('content-type');
  const isApiEndpoint = url.includes('/api/');

  // Flask's SPA catch-all serves index.html (200, text/html) for unmatched
  // /api/ routes instead of 404 - callers must not silently treat that as data.
  if (isApiEndpoint && contentType && contentType.includes('text/html')) {
    throw new ApiError(
      `API returned HTML instead of JSON for ${endpoint} (route likely missing on backend)`,
      response.status,
      null
    );
  }

  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return (await response.text()) as unknown as T;
}
