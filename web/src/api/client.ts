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
  // Stub for X-Astryx-Token header (Sign-off S5, future mutation auth)
  // const token = localStorage.getItem('astryx_api_token');
  // if (token) {
  //   headers.set('X-Astryx-Token', token);
  // }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return (await response.text()) as unknown as T;
}
